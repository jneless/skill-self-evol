import { emptyUsage } from "../constants";
import { unifiedDiff } from "../diff";
import { makeId, nowIso } from "../ids";
import type {
  EvalSet,
  EvaluationPlan,
  EvaluationResult,
  EvaluationScope,
  EvolutionAlgorithm,
  EvolutionCandidate,
  EvolutionConfig,
  EvolutionEnvironmentFile,
  EvolutionExperiment,
  LlmUsage,
} from "../types";
import type { LlmClient } from "./ark";
import { addUsage, extractJsonObject } from "./ark";
import { getEnv } from "./env";
import { runEvaluation } from "./evaluators";
import { getJsonObject, putJsonObject, putTextObject, updateIndex } from "./storage";

const evolutionAlgorithmStrategies: Record<EvolutionAlgorithm, string> = {
  llm_self_optimize:
    "LLM 自优化：直接根据评测证据改写 SKILL.md。优先修复 critical/major findings、失败 case 和不稳定边界，保持文档结构清晰、可下载即用。",
  genetic:
    "遗传算法：把 SKILL.md 拆成 name、description、触发边界、禁止场景、执行步骤、引用说明等基因片段。保留表现好的片段，交叉重组多个优势表达，并对失败维度做小幅变异。避免一次性重写所有内容。",
  particle_swarm:
    "粒子群：把候选 skill 看成粒子。每次改写同时参考当前版本的局部最佳经验和评测证据中的全局最佳方向，让描述、边界、步骤逐步靠近稳定区域。避免剧烈跳变，强调渐进收敛。",
  ant_colony:
    "蚁群优化：把高质量 skill 片段看成带信息素的路径。强化通过评测的触发描述、执行步骤和安全边界，弱化失败片段，沿高信息素路径组合新版本。适合沉淀可复用的稳定表述。",
  immune_clonal:
    "免疫克隆选择：把失败 case、误触发和安全边界视为抗原。克隆能抵抗这些问题的候选片段，并对相关区域高频变异，形成稳定通过关键评测的记忆细胞。强调鲁棒性和边界免疫。",
  simulated_annealing:
    "模拟退火：早期高温阶段允许较大幅度的结构探索和表述替换，以跳出保守局部最优；后期逐步降温，减少改动范围，只做精准修复、措辞收敛和边界补强。越到后续轮次越应避免大改。",
};

export async function runEvolutionExperiment(
  input: {
    skill: string;
    evalSet?: EvalSet;
    triggerEvalSet?: EvalSet;
    singleSkillEvalSet?: EvalSet;
    agentEvalSet?: EvalSet;
    model: string;
    config: EvolutionConfig;
    plan?: EvaluationPlan;
    environmentFiles?: EvolutionEnvironmentFile[];
  },
  llm: LlmClient,
): Promise<EvolutionExperiment> {
  validateConfig(input.config);
  const id = makeId("exp");
  const createdAt = nowIso();
  const candidates: EvolutionCandidate[] = [];
  let usage: LlmUsage = emptyUsage(input.model);
  const effectiveScope = getEvolutionEvaluationScope(input.plan, Boolean(input.evalSet));

  if (input.config.strategy === "direct_improve") {
    let parentContent = input.skill;
    let parentCandidateId: string | undefined;
    let parentEvaluation: EvaluationResult | undefined;

    for (let round = 1; round <= input.config.rounds; round += 1) {
      parentEvaluation =
        parentEvaluation ||
        (await runEvaluation(
          {
            skill: parentContent,
            evalSet: input.evalSet,
            triggerEvalSet: input.triggerEvalSet,
            singleSkillEvalSet: input.singleSkillEvalSet,
            agentEvalSet: input.agentEvalSet,
            model: input.model,
            scope: effectiveScope,
            plan: input.plan,
          },
          llm,
        ));
      usage = addUsage(usage, parentEvaluation.usage);
      const generated = await generateCandidate({
        baseContent: parentContent,
        model: input.model,
        evaluation: parentEvaluation,
        config: input.config,
        environmentFiles: input.environmentFiles || [],
        llm,
        label: `第 ${round} 轮候选`,
      });
      usage = addUsage(usage, generated.usage);
      const evaluation = await runEvaluation(
        {
          skill: generated.content,
          evalSet: input.evalSet,
          triggerEvalSet: input.triggerEvalSet,
          singleSkillEvalSet: input.singleSkillEvalSet,
          agentEvalSet: input.agentEvalSet,
          model: input.model,
          scope: effectiveScope,
          plan: input.plan,
        },
        llm,
      );
      usage = addUsage(usage, evaluation.usage);
      const candidate: EvolutionCandidate = {
        id: makeId("cand"),
        round,
        label: `第 ${round} 轮候选`,
        parentCandidateId,
        content: generated.content,
        changeSummary: generated.changeSummary,
        diff: unifiedDiff(parentContent, generated.content),
        selectedForNextRound: true,
        selectorReason: "Direct Improve 采用链式演进，默认使用本轮候选进入下一轮。",
        evaluation,
      };
      candidates.push(candidate);
      parentContent = generated.content;
      parentCandidateId = candidate.id;
      parentEvaluation = evaluation;
    }
  } else if (input.config.strategy === "diverse_candidates") {
    let parentContent = input.skill;
    let parentCandidateId: string | undefined;

    for (let round = 1; round <= input.config.rounds; round += 1) {
      const parentEvaluation = await runEvaluation(
        {
          skill: parentContent,
          evalSet: input.evalSet,
          triggerEvalSet: input.triggerEvalSet,
          singleSkillEvalSet: input.singleSkillEvalSet,
          agentEvalSet: input.agentEvalSet,
          model: input.model,
          scope: effectiveScope,
          plan: input.plan,
        },
        llm,
      );
      usage = addUsage(usage, parentEvaluation.usage);
      const roundCandidates: EvolutionCandidate[] = [];
      for (let index = 1; index <= input.config.candidatesPerRound; index += 1) {
        const generated = await generateCandidate({
          baseContent: parentContent,
          model: input.model,
          evaluation: parentEvaluation,
          config: input.config,
          environmentFiles: input.environmentFiles || [],
          llm,
          label: `第 ${round} 轮候选 ${index}`,
        });
        usage = addUsage(usage, generated.usage);
        const evaluation = await runEvaluation(
          {
            skill: generated.content,
            evalSet: input.evalSet,
            triggerEvalSet: input.triggerEvalSet,
            singleSkillEvalSet: input.singleSkillEvalSet,
            agentEvalSet: input.agentEvalSet,
            model: input.model,
            scope: effectiveScope,
            plan: input.plan,
          },
          llm,
        );
        usage = addUsage(usage, evaluation.usage);
        roundCandidates.push({
          id: makeId("cand"),
          round,
          label: `第 ${round} 轮候选 ${index}`,
          parentCandidateId,
          content: generated.content,
          changeSummary: generated.changeSummary,
          diff: unifiedDiff(parentContent, generated.content),
          selectedForNextRound: false,
          evaluation,
        });
      }
      const selected = selectCandidate(roundCandidates);
      for (const candidate of roundCandidates) {
        candidate.selectedForNextRound = candidate.id === selected.id;
        candidate.selectorReason =
          candidate.id === selected.id
            ? selected.reason
            : "未被 selector 选中进入下一轮。";
      }
      candidates.push(...roundCandidates);
      parentContent = selected.candidate.content;
      parentCandidateId = selected.candidate.id;
    }
  } else {
    throw new Error("Bio-inspired Search 在 MVP 中尚未启用");
  }

  const experiment: EvolutionExperiment = {
    id,
    model: input.model,
    config: input.config,
    plan: input.plan,
    skillSnapshot: input.skill,
    evalSetSnapshot: input.evalSet,
    evalSetSnapshots: {
      trigger: input.triggerEvalSet,
      singleSkillExecution: input.singleSkillEvalSet,
      agentExecution: input.agentEvalSet,
    },
    environmentFiles: input.environmentFiles || [],
    candidates,
    usage,
    createdAt,
  };

  await saveEvolutionExperiment(experiment);
  return experiment;
}

export async function saveEvolutionExperiment(experiment: EvolutionExperiment) {
  await putTextObject(`experiments/${experiment.id}/input-skill.md`, experiment.skillSnapshot);
  await putJsonObject(
    `experiments/${experiment.id}/eval-set-snapshot.json`,
    experiment.evalSetSnapshot || null,
  );
  await putJsonObject(
    `experiments/${experiment.id}/eval-set-snapshots.json`,
    experiment.evalSetSnapshots || null,
  );
  await putJsonObject(
    `experiments/${experiment.id}/environment-files.json`,
    experiment.environmentFiles || [],
  );
  for (const file of experiment.environmentFiles || []) {
    await putTextObject(
      `experiments/${experiment.id}/environment/${file.id}-${sanitizeFileName(file.name)}`,
      file.content,
    );
  }
  await putJsonObject(`experiments/${experiment.id}/config.json`, experiment.config);
  for (const candidate of experiment.candidates) {
    await putTextObject(
      `experiments/${experiment.id}/candidates/${candidate.id}.md`,
      candidate.content,
    );
  }
  await putJsonObject(`experiments/${experiment.id}/result.json`, experiment);
  await updateIndex("indexes/evolution-experiments.json", {
    id: experiment.id,
    model: experiment.model,
    strategy: experiment.config.strategy,
    candidates: experiment.candidates.length,
    createdAt: experiment.createdAt,
  });
}

function getEvolutionEvaluationScope(
  plan?: EvaluationPlan,
  hasLegacyEvalSet = false,
): EvaluationScope {
  if (!plan) {
    return {
      generalStatic: true,
      evalSetFit: false,
      routing: hasLegacyEvalSet,
      execution: hasLegacyEvalSet,
    };
  }

  return {
    generalStatic: plan.staticReview,
    evalSetFit: false,
    routing: Boolean(plan.triggerEvalSetId),
    execution: Boolean(plan.singleSkillEvalSetId),
  };
}

export async function listEvolutionExperiments() {
  return getJsonObject<
    Array<{ id: string; model: string; strategy: string; candidates: number; createdAt: string }>
  >("indexes/evolution-experiments.json", []);
}

export async function getEvolutionExperiment(id: string) {
  return getJsonObject<EvolutionExperiment | null>(
    `experiments/${id}/result.json`,
    null,
  );
}

async function generateCandidate(input: {
  baseContent: string;
  model: string;
  evaluation: EvaluationResult;
  config: EvolutionConfig;
  environmentFiles: EvolutionEnvironmentFile[];
  llm: LlmClient;
  label: string;
}) {
  const response = await input.llm.complete(
    [
      {
        role: "system",
        content:
          "你是 SKILL.md 自进化助手。根据评测证据改进 SKILL.md。只输出 JSON，字段为 content 和 changeSummary。",
      },
      {
        role: "user",
        content: JSON.stringify({
          label: input.label,
          preference: input.config.preference,
          goal: input.config.goal,
          evolutionAlgorithm: getEvolutionAlgorithm(input.config),
          evolutionAlgorithmStrategy:
            evolutionAlgorithmStrategies[getEvolutionAlgorithm(input.config)],
          generationMode: input.config.strategy,
          lockName: input.config.lockName,
          lockDescription: input.config.lockDescription,
          environmentFiles: formatEnvironmentFilesForPrompt(input.environmentFiles),
          evidence: {
            staticFindings: input.evaluation.staticFindings,
            evalSetFindings: input.evaluation.evalSetFindings,
            routingResults: input.evaluation.routingResults,
            executionResults: input.evaluation.executionResults,
          },
          baseContent: input.baseContent,
          instruction:
            "不要追逐分数。严格遵循 evolutionAlgorithmStrategy 生成文本变化。优先修复 critical/major findings 和 fail/partial cases。保持 SKILL.md 可直接下载使用。",
        }),
      },
    ],
    { temperature: input.config.strategy === "diverse_candidates" ? 0.7 : 0.35 },
  );
  const parsed = extractJsonObject<{ content?: string; changeSummary?: string }>(
    response.content,
    {},
  );
  return {
    content: parsed.content || input.baseContent,
    changeSummary: parsed.changeSummary || "模型未返回变更摘要。",
    usage: response.usage,
  };
}

function getEvolutionAlgorithm(config: EvolutionConfig): EvolutionAlgorithm {
  return config.algorithm || "llm_self_optimize";
}

function formatEnvironmentFilesForPrompt(files: EvolutionEnvironmentFile[]) {
  const maxTotalChars = 12000;
  const maxFileChars = 4000;
  let used = 0;

  return files.map((file) => {
    const remaining = Math.max(maxTotalChars - used, 0);
    const limit = Math.min(maxFileChars, remaining);
    const content = file.content.slice(0, limit);
    used += content.length;
    return {
      name: file.name,
      type: file.type || "text/plain",
      size: file.size,
      content,
      truncated: file.content.length > content.length,
    };
  });
}

function sanitizeFileName(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "reference.txt";
}

function selectCandidate(candidates: EvolutionCandidate[]) {
  const ranked = [...candidates].sort((a, b) => evidenceRank(b) - evidenceRank(a));
  const candidate = ranked[0];
  return {
    id: candidate.id,
    candidate,
    reason:
      "selector 基于结构化证据选择：优先减少 critical/major 问题、避免新增严重风险，并保持 skill 意图一致。",
  };
}

function evidenceRank(candidate: EvolutionCandidate) {
  const findings = [
    ...candidate.evaluation.staticFindings,
    ...candidate.evaluation.evalSetFindings,
  ];
  const critical = findings.filter((item) => item.severity === "critical").length;
  const major = findings.filter((item) => item.severity === "major").length;
  const failedCases = [
    ...candidate.evaluation.routingResults,
    ...candidate.evaluation.executionResults,
  ].filter((item) => item.status === "fail").length;
  const partialCases = [
    ...candidate.evaluation.routingResults,
    ...candidate.evaluation.executionResults,
  ].filter((item) => item.status === "partial").length;

  return 1000 - critical * 100 - major * 40 - failedCases * 60 - partialCases * 20;
}

function validateConfig(config: EvolutionConfig) {
  const env = getEnv();
  if (config.strategy === "bio_inspired") {
    throw new Error("Bio-inspired Search 在 MVP 中尚未启用");
  }
  if (config.strategy === "direct_improve" && config.rounds > env.MAX_DIRECT_IMPROVE_ROUNDS) {
    throw new Error(`Direct Improve 最多支持 ${env.MAX_DIRECT_IMPROVE_ROUNDS} 轮`);
  }
  if (
    config.strategy === "diverse_candidates" &&
    config.rounds > env.MAX_DIVERSE_CANDIDATE_ROUNDS
  ) {
    throw new Error(`Diverse Candidates 最多支持 ${env.MAX_DIVERSE_CANDIDATE_ROUNDS} 轮`);
  }
  if (config.candidatesPerRound > env.MAX_DIVERSE_CANDIDATES_PER_ROUND) {
    throw new Error(`每轮最多支持 ${env.MAX_DIVERSE_CANDIDATES_PER_ROUND} 个候选`);
  }
}
