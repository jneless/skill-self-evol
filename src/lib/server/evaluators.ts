import { defaultCompetitionPool, emptyUsage, evaluatorVersions } from "../constants";
import { makeId, nowIso } from "../ids";
import { parseSkillMarkdown } from "../skill-parser";
import { scanSkillReferences } from "../reference-scan";
import type {
  EvalSet,
  CaseSuggestionOptions,
  EvaluationPlan,
  EvaluationResult,
  EvaluationRun,
  EvaluationScope,
  ExecutionCaseResult,
  RoutingCaseResult,
  StaticFinding,
  SuggestedCasesResult,
  TaskProgress,
} from "../types";
import type { LlmClient } from "./ark";
import { addUsage, extractJsonObject } from "./ark";
import { updateIndex, putJsonObject, getJsonObject } from "./storage";

export const fullEvaluationScope: EvaluationScope = {
  generalStatic: true,
  evalSetFit: true,
  routing: true,
  execution: true,
};

type EvaluationProgressReporter = (progress: TaskProgress) => Promise<void> | void;

export function getEvaluationStepTotal(scope: EvaluationScope, evalSet?: EvalSet) {
  let total = 0;
  if (scope.generalStatic) total += 1;
  if (scope.evalSetFit && evalSet) total += 1;
  if (scope.routing && evalSet) total += evalSet.routingCases.length;
  if (scope.execution && evalSet) total += evalSet.executionCases.length;
  return Math.max(total, 1);
}

export function getEvaluationPlanStepTotal(input: {
  plan?: EvaluationPlan;
  scope: EvaluationScope;
  evalSet?: EvalSet;
  triggerEvalSet?: EvalSet;
  singleSkillEvalSet?: EvalSet;
  agentEvalSet?: EvalSet;
}) {
  const triggerEvalSet = input.triggerEvalSet || input.evalSet;
  const singleSkillEvalSet = input.singleSkillEvalSet || input.evalSet;
  let total = 0;
  if (input.plan ? input.plan.staticReview : input.scope.generalStatic) total += 1;
  if (input.scope.evalSetFit && input.evalSet) total += 1;
  if (input.scope.routing && triggerEvalSet) total += triggerEvalSet.routingCases.length;
  if (input.scope.execution && singleSkillEvalSet) {
    total += singleSkillEvalSet.executionCases.length;
  }
  if (input.agentEvalSet) total += Math.max(input.agentEvalSet.executionCases.length, 1);
  return Math.max(total, 1);
}

export async function runEvaluation(
  input: {
    skill: string;
    evalSet?: EvalSet;
    triggerEvalSet?: EvalSet;
    singleSkillEvalSet?: EvalSet;
    agentEvalSet?: EvalSet;
    model: string;
    scope: EvaluationScope;
    plan?: EvaluationPlan;
  },
  llm: LlmClient,
  options: { onProgress?: EvaluationProgressReporter } = {},
): Promise<EvaluationResult> {
  let usage = emptyUsage(input.model);
  const total = getEvaluationPlanStepTotal(input);
  const triggerEvalSet = input.triggerEvalSet || input.evalSet;
  const singleSkillEvalSet = input.singleSkillEvalSet || input.evalSet;
  let completed = 0;
  const report = async (label: string, nextCompleted = completed) => {
    await options.onProgress?.({ completed: nextCompleted, total, label });
  };

  let staticFindings: StaticFinding[] = [];
  if (input.scope.generalStatic) {
    await report("检查 SKILL.md 静态质量");
    staticFindings = runGeneralStaticReview(input.skill);
    completed += 1;
    await report("已完成静态质量检查", completed);
  }

  let evalSetFindings: StaticFinding[] = [];
  if (input.scope.evalSetFit && input.evalSet) {
    await report("检查评测集匹配度");
    evalSetFindings = runEvalSetFitReview(input.skill, input.evalSet);
    completed += 1;
    await report("已完成评测集匹配度检查", completed);
  }

  const routingResults: RoutingCaseResult[] = [];
  if (input.scope.routing && triggerEvalSet) {
    for (const [index, routingCase] of triggerEvalSet.routingCases.entries()) {
      await report(
        `触发评测 ${index + 1}/${triggerEvalSet.routingCases.length}: ${routingCase.name}`,
      );
      const result = await runRoutingCase(input.skill, routingCase, input.model, llm);
      usage = addUsage(usage, result.usage);
      routingResults.push(result.value);
      completed += 1;
      await report(
        `已完成触发评测 ${index + 1}/${triggerEvalSet.routingCases.length}`,
        completed,
      );
    }
  }

  const executionResults: ExecutionCaseResult[] = [];
  if (input.scope.execution && singleSkillEvalSet) {
    for (const [index, executionCase] of singleSkillEvalSet.executionCases.entries()) {
      await report(
        `效果评测 ${index + 1}/${singleSkillEvalSet.executionCases.length}: ${executionCase.name}`,
      );
      const result = await runExecutionCase(
        input.skill,
        executionCase,
        input.model,
        llm,
      );
      usage = addUsage(usage, result.usage);
      executionResults.push(result.value);
      completed += 1;
      await report(
        `已完成效果评测 ${index + 1}/${singleSkillEvalSet.executionCases.length}`,
        completed,
      );
    }
  }

  if (input.agentEvalSet) {
    await report("真实 agent 执行评测暂未接入");
    evalSetFindings.push({
      id: makeId("finding"),
      severity: "major",
      dimension: "agent-execution",
      message: "真实 agent 执行效果评测暂未接入",
      suggestedFix: "当前版本先保留 agent 实际执行效果评测集，后续接入真实 agent runner 后再运行。",
    });
    completed += Math.max(input.agentEvalSet.executionCases.length, 1);
    await report("已跳过真实 agent 执行评测", completed);
  }

  const score = computeHumanScore({
    staticFindings,
    evalSetFindings,
    routingResults,
    executionResults,
  });

  return {
    summary: summarizeResult(score, staticFindings, routingResults, executionResults),
    score,
    dimensions: [
      { name: "静态质量", score: scoreDimension(staticFindings) },
      { name: "触发质量", score: scoreCases(routingResults) },
      { name: "效果质量", score: scoreCases(executionResults) },
      { name: "安全与边界", score: scoreSafety(staticFindings) },
    ],
    staticFindings,
    evalSetFindings,
    routingResults,
    executionResults,
    usage,
    evaluatorVersions,
  };
}

export async function saveEvaluationRun(run: Omit<EvaluationRun, "id" | "createdAt">) {
  const id = makeId("run");
  const createdAt = nowIso();
  const fullRun: EvaluationRun = { id, createdAt, ...run };
  await putJsonObject(`runs/${id}/input-skill.md.json`, { content: run.skillSnapshot });
  await putJsonObject(`runs/${id}/eval-set-snapshot.json`, run.evalSetSnapshot || null);
  await putJsonObject(`runs/${id}/result.json`, fullRun);
  await updateIndex("indexes/evaluation-runs.json", {
    id,
    model: run.model,
    score: run.result.score,
    createdAt,
  });
  return fullRun;
}

export async function listEvaluationRuns() {
  return getJsonObject<Array<{ id: string; model: string; score: number; createdAt: string }>>(
    "indexes/evaluation-runs.json",
    [],
  );
}

export async function getEvaluationRun(id: string) {
  return getJsonObject<EvaluationRun | null>(`runs/${id}/result.json`, null);
}

export async function suggestCases(
  skill: string,
  model: string,
  llm: LlmClient,
  options: CaseSuggestionOptions,
): Promise<SuggestedCasesResult> {
  const metadata = parseSkillMarkdown(skill);
  const typeGuidance: Record<CaseSuggestionOptions["evalSetType"], string> = {
    trigger:
      "设计可触发性评测数据：核心是判断当前 skill 在给定用户输入、记忆/上下文、其他候选 skill 名称和描述存在时，是否应该被触发。正例 expectedSkill 填当前 skill name；负例填 none 或更合适的其他 skill name。",
    single_skill_execution:
      "设计单 skill 预期执行效果评测数据：默认 skill 已经被触发，核心是判断只看这个 SKILL.md 时，执行产物是否满足预期。不要再考察是否触发；expectedResult 必须描述可核查的理想执行结果。",
    agent_execution:
      "设计 agent 实际执行效果评测数据：核心是判断真实 agent 使用该 skill 后的最终任务结果是否满足预期。不要再考察是否触发；expectedResult 必须描述可核查的最终交付结果。",
  };
  const focusGuidance: Record<CaseSuggestionOptions["focus"], string> = {
    typical: "优先覆盖最常见、最能代表 skill 用途的场景。",
    boundary: "优先覆盖边界输入、模糊表达、多轮上下文缺失或条件不完整的场景。",
    negative: "优先覆盖不应触发、容易误判、或执行结果容易失败/不完整的场景。",
    regression: "优先覆盖后续优化中最容易回退的核心能力和关键约束。",
  };
  const outputShape =
    options.evalSetType === "trigger"
      ? {
          routingCases: [
            {
              name: "string",
              prompt: "string",
              memoryAndContext: "string",
              expectedSkill: "string|none",
              candidateSkills: [{ name: "string", description: "string" }],
            },
          ],
        }
      : {
          executionCases: [
            {
              name: "string",
              taskInput: "string",
              memoryAndContext: "string",
              expectedResult: "string",
            },
          ],
        };
  const response = await llm.complete(
    [
      {
        role: "system",
        content:
          "你是 skill 评测集设计助手。只输出 JSON，不要输出解释文字。",
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "为 SKILL.md 生成评测数据",
          evalSetType: options.evalSetType,
          count: options.count,
          difficulty: options.difficulty,
          focus: options.focus,
          typeGuidance: typeGuidance[options.evalSetType],
          focusGuidance: focusGuidance[options.focus],
          requirements: {
            includeMemoryAndContext: options.includeMemoryAndContext,
            includeNegativeCases: options.includeNegativeCases,
            includeCompetingSkills: options.includeCompetingSkills,
            expectedSkillForTrigger:
              "可触发性数据需要 expectedSkill。正例通常填当前 skill name；负例可以填其他 skill name 或 none。",
            expectedResultForExecution:
              "效果数据需要 expectedResult，写成可判定的目标结果，不要只写笼统形容词。",
          },
          currentSkill: {
            name: metadata.name || "unknown",
            description: metadata.description || "missing",
            skillMarkdown: skill,
          },
          outputShape,
        }),
      },
    ],
    { temperature: 0.4 },
  );

  const parsed = extractJsonObject<{
    routingCases?: Array<{
      name?: string;
      prompt?: string;
      memoryAndContext?: string;
      expectedSkill?: string;
      candidateSkills?: Array<{ name?: string; description?: string }>;
    }>;
    executionCases?: Array<{
      name?: string;
      taskInput?: string;
      memoryAndContext?: string;
      expectedBehavior?: string;
      expectedResult?: string;
    }>;
  }>(response.content, {});

  return {
    routingCases: (parsed.routingCases || []).slice(0, options.count).map((item) => ({
      id: makeId("route_case"),
      name: item.name || "建议可触发性数据",
      prompt: item.prompt || "",
      memoryAndContext: item.memoryAndContext || "",
      expectedSkill: item.expectedSkill || metadata.name || "target-skill",
      candidateSkills: (item.candidateSkills || [])
        .filter((skill) => skill.name)
        .map((skill) => ({
          name: skill.name || "",
          description: skill.description || "",
        })),
    })),
    executionCases: (parsed.executionCases || []).slice(0, options.count).map((item) => ({
      id: makeId("exec_case"),
      name: item.name || "建议效果数据",
      taskInput: item.taskInput || "",
      memoryAndContext: item.memoryAndContext || "",
      expectedBehavior: item.expectedResult || item.expectedBehavior || "",
      expectedResult: item.expectedResult || item.expectedBehavior || "",
    })),
    usage: response.usage,
  };
}

function runGeneralStaticReview(skill: string): StaticFinding[] {
  const metadata = parseSkillMarkdown(skill);
  const references = scanSkillReferences(skill);
  const findings: StaticFinding[] = [];

  if (metadata.parseError) {
    findings.push({
      id: makeId("finding"),
      severity: "critical",
      dimension: "frontmatter",
      message: "frontmatter 无法解析",
      evidenceSnippet: metadata.parseError,
      suggestedFix: "修复 YAML frontmatter 格式。",
    });
  }
  if (!metadata.name) {
    findings.push({
      id: makeId("finding"),
      severity: "critical",
      dimension: "metadata",
      message: "缺少 name",
      suggestedFix: "在 frontmatter 中补充明确的 name。",
    });
  }
  if (!metadata.description) {
    findings.push({
      id: makeId("finding"),
      severity: "critical",
      dimension: "routing",
      message: "缺少 description",
      suggestedFix: "补充说明何时应该使用这个 skill。",
    });
  }
  if (metadata.description && metadata.description.length < 24) {
    findings.push({
      id: makeId("finding"),
      severity: "major",
      dimension: "routing",
      message: "description 过短，可能无法稳定触发",
      evidenceSnippet: metadata.description,
      suggestedFix: "补充适用场景、边界和不适用场景。",
    });
  }
  if (!/do not|不要|不应|禁止|not use|不用于/i.test(skill)) {
    findings.push({
      id: makeId("finding"),
      severity: "major",
      dimension: "boundary",
      message: "缺少明确的不适用或禁止场景",
      suggestedFix: "补充这个 skill 不应该使用的场景。",
    });
  }
  if (!/step|步骤|流程|workflow|process/i.test(skill)) {
    findings.push({
      id: makeId("finding"),
      severity: "major",
      dimension: "execution",
      message: "缺少清晰操作流程",
      suggestedFix: "增加按顺序执行的步骤或工作流说明。",
    });
  }
  for (const reference of references) {
    findings.push({
      id: makeId("finding"),
      severity: "minor",
      dimension: "references",
      message: `检测到外部引用：${reference.path}`,
      evidenceSnippet: reference.path,
      suggestedFix: "如果上传 zip，平台会检查该路径是否存在。",
    });
  }

  return findings;
}

function runEvalSetFitReview(skill: string, evalSet: EvalSet): StaticFinding[] {
  const metadata = parseSkillMarkdown(skill);
  const findings: StaticFinding[] = [];
  const combinedCases = [
    ...evalSet.routingCases.map((item) => item.prompt),
    ...evalSet.executionCases.map((item) => item.taskInput),
  ].join("\n");

  if (!combinedCases.trim()) {
    findings.push({
      id: makeId("finding"),
      severity: "major",
      dimension: "eval-set",
      message: "评测集为空，无法支持自进化实验",
      suggestedFix: "至少添加一个触发评测或效果评测 case。",
    });
  }
  if (metadata.description && combinedCases) {
    const terms = metadata.description
      .toLowerCase()
      .split(/[^a-z0-9\u4e00-\u9fa5]+/)
      .filter((term) => term.length >= 3);
    const overlap = terms.some((term) => combinedCases.toLowerCase().includes(term));
    if (!overlap) {
      findings.push({
        id: makeId("finding"),
        severity: "minor",
        dimension: "eval-set-fit",
        message: "description 与评测集任务文本重叠较少",
        suggestedFix: "确认评测集是否确实适合当前 skill。",
      });
    }
  }

  return findings;
}

async function runRoutingCase(
  skill: string,
  routingCase: { id: string; name: string; prompt: string; memoryAndContext?: string; expectedSkill: string; candidateSkills?: Array<{ name: string; description: string }> },
  model: string,
  llm: LlmClient,
) {
  const metadata = parseSkillMarkdown(skill);
  const candidates = [
    { name: metadata.name || "target-skill", description: metadata.description || "" },
    ...(routingCase.candidateSkills?.length ? routingCase.candidateSkills : defaultCompetitionPool),
  ];
  const response = await llm.complete([
    {
      role: "system",
      content:
        "你是 skill router 模拟器。根据 prompt 和候选 skill description 选择一个 skill name 或 none。只输出 JSON。",
    },
    {
      role: "user",
      content: JSON.stringify({
        prompt: routingCase.prompt,
        memoryAndContext: routingCase.memoryAndContext || "",
        expectedSkill: routingCase.expectedSkill,
        candidates,
        outputShape: {
          actualSkill: "string",
          status: "pass|partial|fail",
          reason: "string",
          suggestedFix: "string",
        },
      }),
    },
  ]);
  const parsed = extractJsonObject<{
    actualSkill?: string;
    status?: "pass" | "partial" | "fail";
    reason?: string;
    suggestedFix?: string;
  }>(response.content, {});
  const actualSkill = parsed.actualSkill || "none";
  const status =
    parsed.status ||
    (actualSkill === routingCase.expectedSkill ? "pass" : "fail");

  return {
    usage: response.usage,
    value: {
      caseId: routingCase.id,
      caseName: routingCase.name,
      status,
      severity: status === "fail" ? "major" : "minor",
      expectedSkill: routingCase.expectedSkill,
      actualSkill,
      reason: parsed.reason || "模拟 router 已完成判断。",
      suggestedFix: parsed.suggestedFix,
    } satisfies RoutingCaseResult,
  };
}

async function runExecutionCase(
  skill: string,
  executionCase: { id: string; name: string; taskInput: string; memoryAndContext?: string; expectedBehavior: string; expectedResult?: string; rubric?: string; forbiddenBehavior?: string; optionalContext?: string },
  model: string,
  llm: LlmClient,
) {
  const simulated = await llm.complete(
    [
      {
        role: "system",
        content:
          "你模拟一个已经触发该 SKILL.md 的 agent。不要调用真实工具，只输出最终结果。",
      },
      {
        role: "user",
        content: `SKILL.md:\n${skill}\n\n任务:\n${executionCase.taskInput}\n\n上下文:\n${executionCase.memoryAndContext || executionCase.optionalContext || "无"}`,
      },
    ],
    { temperature: 0.3 },
  );
  const judged = await llm.complete([
    {
      role: "system",
      content:
        "你是 skill 效果评测 judge。根据期望行为和禁止事项评估模拟输出。只输出 JSON。",
    },
    {
      role: "user",
      content: JSON.stringify({
        taskInput: executionCase.taskInput,
        memoryAndContext: executionCase.memoryAndContext || executionCase.optionalContext || "",
        expectedBehavior: executionCase.expectedResult || executionCase.expectedBehavior,
        rubric: executionCase.rubric,
        forbiddenBehavior: executionCase.forbiddenBehavior,
        simulatedOutput: simulated.content,
        outputShape: {
          status: "pass|partial|fail",
          reason: "string",
          evidence: "string",
          suggestedFix: "string",
        },
      }),
    },
  ]);
  const parsed = extractJsonObject<{
    status?: "pass" | "partial" | "fail";
    reason?: string;
    evidence?: string;
    suggestedFix?: string;
  }>(judged.content, {});

  return {
    usage: addUsage(simulated.usage, judged.usage),
    value: {
      caseId: executionCase.id,
      caseName: executionCase.name,
      status: parsed.status || "partial",
      severity: parsed.status === "fail" ? "major" : "minor",
      simulatedOutput: simulated.content,
      reason: parsed.reason || "已根据期望行为完成模拟评估。",
      evidence: parsed.evidence,
      suggestedFix: parsed.suggestedFix,
    } satisfies ExecutionCaseResult,
  };
}

function computeHumanScore(input: {
  staticFindings: StaticFinding[];
  evalSetFindings: StaticFinding[];
  routingResults: RoutingCaseResult[];
  executionResults: ExecutionCaseResult[];
}) {
  let score = 100;
  for (const finding of [...input.staticFindings, ...input.evalSetFindings]) {
    score -= finding.severity === "critical" ? 18 : finding.severity === "major" ? 10 : 3;
  }
  for (const result of [...input.routingResults, ...input.executionResults]) {
    score -= result.status === "fail" ? 12 : result.status === "partial" ? 5 : 0;
  }
  return Math.max(0, Math.min(100, score));
}

function scoreDimension(findings: StaticFinding[]) {
  return Math.max(0, 100 - findings.reduce((sum, item) => sum + (item.severity === "critical" ? 18 : item.severity === "major" ? 10 : 3), 0));
}

function scoreSafety(findings: StaticFinding[]) {
  return scoreDimension(findings.filter((item) => ["boundary", "safety"].includes(item.dimension)));
}

function scoreCases(cases: Array<{ status: "pass" | "partial" | "fail" }>) {
  if (!cases.length) return 100;
  const total = cases.reduce((sum, item) => sum + (item.status === "pass" ? 100 : item.status === "partial" ? 60 : 20), 0);
  return Math.round(total / cases.length);
}

function summarizeResult(
  score: number,
  findings: StaticFinding[],
  routing: RoutingCaseResult[],
  execution: ExecutionCaseResult[],
) {
  const critical = findings.filter((item) => item.severity === "critical").length;
  const failedCases = [...routing, ...execution].filter((item) => item.status === "fail").length;
  if (critical || failedCases) {
    return `当前 skill 仍有 ${critical} 个 critical 静态问题和 ${failedCases} 个失败 case，建议先基于证据修复。`;
  }
  if (score >= 85) return "当前 skill 表现较稳，可以比较候选版本的细节差异。";
  return "当前 skill 基本可评测，但仍有若干可改进点。";
}
