"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  CurrentSkill,
  CaseSuggestionOptions,
  EvalSet,
  EvalSetType,
  EvaluationPlan,
  EvaluationRun,
  EvaluationScope,
  EvolutionAlgorithm,
  EvolutionConfig,
  EvolutionEnvironmentFile,
  EvolutionExperiment,
  OptimizationPreference,
  RoutingCase,
  ExecutionCase,
  TaskRecord,
} from "@/lib/types";
import { unifiedDiff } from "@/lib/diff";
import { makeId } from "@/lib/ids";

type View = "skill" | "evalSets" | "evaluation" | "evolution";

const defaultScope: EvaluationScope = {
  generalStatic: true,
  evalSetFit: false,
  routing: true,
  execution: true,
};

const visibleEvaluationScopes: Array<{
  key: keyof EvaluationPlan;
  label: string;
  type?: EvalSetType;
  disabled?: boolean;
}> = [
  { key: "staticReview", label: "静态质量检查" },
  { key: "triggerEvalSetId", label: "可触发性评测", type: "trigger" },
  {
    key: "singleSkillEvalSetId",
    label: "单 skill 预期执行效果评测",
    type: "single_skill_execution",
  },
  {
    key: "agentEvalSetId",
    label: "agent 实际执行效果评测",
    type: "agent_execution",
    disabled: true,
  },
];

const staticReviewChecks = [
  "frontmatter 是否能正常解析",
  "是否包含 name 和 description",
  "description 是否足够描述触发场景",
  "是否写明不适用或禁止使用场景",
  "是否包含清晰的操作流程或步骤",
  "是否引用了 references/scripts/assets/templates 等外部文件",
];

type EvalSetIndexItem = {
  id: string;
  type: EvalSetType;
  name: string;
};

const evalSetTypeLabels: Record<EvalSetType, string> = {
  trigger: "可触发性",
  single_skill_execution: "单 skill 效果",
  agent_execution: "agent 实际效果",
};

const suggestionFocusLabels: Record<
  EvalSetType,
  Record<CaseSuggestionOptions["focus"], string>
> = {
  trigger: {
    typical: "典型触发",
    boundary: "边界触发",
    negative: "负例/误触发",
    regression: "回归稳定性",
  },
  single_skill_execution: {
    typical: "典型任务",
    boundary: "边界任务",
    negative: "失败/不完整结果",
    regression: "回归稳定性",
  },
  agent_execution: {
    typical: "典型任务",
    boundary: "边界任务",
    negative: "失败/不完整结果",
    regression: "回归稳定性",
  },
};

const suggestionNegativeLabels: Record<EvalSetType, string> = {
  trigger: "包含负例/边界例",
  single_skill_execution: "包含失败/边界结果",
  agent_execution: "包含失败/边界结果",
};

const evolutionAlgorithmOptions: Array<{
  key: EvolutionAlgorithm;
  title: string;
  description: string;
}> = [
  {
    key: "llm_self_optimize",
    title: "LLM 自优化",
    description: "直接根据评测证据改写 SKILL.md，优先修复失败项和静态问题。",
  },
  {
    key: "genetic",
    title: "遗传算法",
    description: "把 skill 片段视为基因，保留优势片段，交叉重组，并对失败维度局部变异。",
  },
  {
    key: "particle_swarm",
    title: "粒子群",
    description: "候选像粒子一样同时参考自身最佳与全局最佳，逐步靠近更稳定的描述和流程。",
  },
  {
    key: "ant_colony",
    title: "蚁群优化",
    description: "通过信息素强化高质量片段路径，弱化失败片段，组合更可靠的触发和执行路径。",
  },
  {
    key: "immune_clonal",
    title: "免疫克隆选择",
    description: "克隆能抵抗失败 case 的候选并高频变异，强化关键边界和安全记忆。",
  },
  {
    key: "simulated_annealing",
    title: "模拟退火",
    description: "早期允许较大改写探索，后期逐步降温收敛，只保留更稳的精修变化。",
  },
];

const evolutionGenerationModeOptions: Array<{
  key: EvolutionConfig["strategy"];
  title: string;
  description: string;
}> = [
  {
    key: "direct_improve",
    title: "Direct Improve",
    description: "链式生成，每轮基于上一轮继续改进。",
  },
  {
    key: "diverse_candidates",
    title: "Diverse Candidates",
    description: "树形生成，每轮生成多个候选，由 selector 选择下一轮父节点。",
  },
];

const emptySkill: CurrentSkill = {
  content: "",
  metadata: { frontmatter: {}, body: "" },
  references: [],
  sourceType: "empty",
};

export default function WorkbenchClient() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [view, setView] = useState<View>("skill");
  const [skill, setSkill] = useState<CurrentSkill>(emptySkill);
  const [skillDraft, setSkillDraft] = useState("");
  const [saveState, setSaveState] = useState("未保存");
  const [evalSetIndex, setEvalSetIndex] = useState<EvalSetIndexItem[]>([]);
  const [evalSet, setEvalSet] = useState<EvalSet | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [runs, setRuns] = useState<Array<{ id: string; score: number; createdAt: string }>>([]);
  const [selectedRun, setSelectedRun] = useState<EvaluationRun | null>(null);
  const [experiments, setExperiments] = useState<
    Array<{ id: string; strategy: string; candidates: number; createdAt: string }>
  >([]);
  const [selectedExperiment, setSelectedExperiment] = useState<EvolutionExperiment | null>(null);
  const [scope, setScope] = useState(defaultScope);
  const [evaluationPlan, setEvaluationPlan] = useState<EvaluationPlan>({
    staticReview: true,
  });
  const [evolutionPlan, setEvolutionPlan] = useState<EvaluationPlan>({
    staticReview: true,
  });
  const [evolutionEnvironmentFiles, setEvolutionEnvironmentFiles] = useState<
    EvolutionEnvironmentFile[]
  >([]);
  const [evolutionConfig, setEvolutionConfig] = useState<EvolutionConfig>({
    algorithm: "llm_self_optimize",
    strategy: "direct_improve",
    rounds: 2,
    candidatesPerRound: 1,
    preference: "balanced",
    goal: "",
    lockName: false,
    lockDescription: false,
  });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authed = Boolean(token);

  useEffect(() => {
    const storedToken = sessionStorage.getItem("workspace-token");
    if (storedToken) queueMicrotask(() => setToken(storedToken));
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadInitialData();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      void refreshCurrentTask();
    }, 2500);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!token || skillDraft === skill.content) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const updated = await api<CurrentSkill>("/api/workspace/skill", {
          method: "PUT",
          body: JSON.stringify({ content: skillDraft }),
        });
        setSkill(updated);
        setSaveState(`已保存 ${new Date().toLocaleTimeString()}`);
      } catch (error) {
        setSaveState(error instanceof Error ? error.message : "保存失败");
      }
    }, 1600);
  }, [skillDraft, skill.content, token]);

  const currentTaskActive = task && ["queued", "running"].includes(task.status);

  async function login() {
    setAuthError("");
    try {
      const result = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await result.json()) as { token?: string; error?: string };
      if (!result.ok || !data.token) throw new Error(data.error || "验证失败");
      sessionStorage.setItem("workspace-token", data.token);
      setToken(data.token);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "验证失败");
    }
  }

  async function loadInitialData() {
    const [skillData, modelData, evalSets, taskData, runData, experimentData] =
      await Promise.all([
        api<CurrentSkill>("/api/workspace/skill"),
        api<{ defaultModel: string; models: string[] }>("/api/models"),
        api<EvalSetIndexItem[]>("/api/eval-sets"),
        api<TaskRecord | null>("/api/tasks/current"),
        api<Array<{ id: string; score: number; createdAt: string }>>(
          "/api/evaluation-runs",
        ),
        api<Array<{ id: string; strategy: string; candidates: number; createdAt: string }>>(
          "/api/evolution-experiments",
        ),
      ]);
    setSkill(skillData);
    setSkillDraft(skillData.content);
    setModels(modelData.models);
    setModel(modelData.defaultModel || modelData.models[0] || "");
    setEvalSetIndex(evalSets);
    setTask(taskData);
    setRuns(runData);
    setExperiments(experimentData);
    if (evalSets[0]) await selectEvalSet(evalSets[0].id);
  }

  async function refreshCurrentTask() {
    const current = await api<TaskRecord | null>("/api/tasks/current");
    setTask(current);
    if (current?.id) {
      const detail = await api<{ task: TaskRecord | null; result: unknown }>(
        `/api/tasks/${current.id}`,
      );
      setTask(detail.task);
      if (detail.task?.status === "succeeded") {
        await refreshHistory();
        const generated = parseGeneratedEvalSet(detail.result);
        if (generated) {
          setEvalSet(generated);
          setEvalSetIndex(await api("/api/eval-sets"));
        }
      }
    }
  }

  async function refreshHistory() {
    setRuns(await api("/api/evaluation-runs"));
    setExperiments(await api("/api/evolution-experiments"));
  }

  async function selectEvalSet(id: string) {
    if (!id) {
      setEvalSet(null);
      return;
    }
    const data = await api<EvalSet>(`/api/eval-sets/${id}`);
    setEvalSet(data);
  }

  async function createEvalSet(type: EvalSetType) {
    const created = await api<EvalSet>("/api/eval-sets", {
      method: "POST",
      body: JSON.stringify({
        type,
        name: "新的评测集",
        description: "",
        routingCases: [],
        executionCases: [],
      }),
    });
    setEvalSet(created);
    setEvalSetIndex(await api("/api/eval-sets"));
  }

  async function saveEvalSet(next: EvalSet) {
    setEvalSet(next);
    await api<EvalSet>(`/api/eval-sets/${next.id}`, {
      method: "PUT",
      body: JSON.stringify(next),
    });
    setEvalSetIndex(await api("/api/eval-sets"));
  }

  async function deleteEvalSet(id: string) {
    if (!window.confirm("确认删除这个评测集？")) return;
    await api<{ ok: true }>(`/api/eval-sets/${id}`, { method: "DELETE" });
    const nextIndex = await api<EvalSetIndexItem[]>("/api/eval-sets");
    setEvalSetIndex(nextIndex);
    if (evalSet?.id !== id) return;
    if (nextIndex[0]) {
      await selectEvalSet(nextIndex[0].id);
    } else {
      setEvalSet(null);
    }
  }

  async function uploadSkill(file: File) {
    const form = new FormData();
    form.append("file", file);
    const updated = await api<CurrentSkill>("/api/workspace/skill/upload", {
      method: "POST",
      body: form,
      headers: {},
    });
    setSkill(updated);
    setSkillDraft(updated.content);
    setSaveState(`已上传 ${new Date().toLocaleTimeString()}`);
  }

  async function startEvaluation() {
    if (!model) return;
    const created = await api<TaskRecord>("/api/evaluation-runs", {
      method: "POST",
      body: JSON.stringify({ model, plan: evaluationPlan, scope }),
    });
    setTask(created);
    setView("evaluation");
  }

  async function startEvolution() {
    if (!model) return;
    const config =
      evolutionConfig.strategy === "direct_improve"
        ? { ...evolutionConfig, candidatesPerRound: 1 }
        : evolutionConfig;
    const created = await api<TaskRecord>("/api/evolution-experiments", {
      method: "POST",
      body: JSON.stringify({
        model,
        config,
        plan: evolutionPlan,
        environmentFiles: evolutionEnvironmentFiles,
      }),
    });
    setTask(created);
    setView("evolution");
  }

  async function generateCases(options: CaseSuggestionOptions) {
    if (!model || !evalSet) return;
    const created = await api<TaskRecord>("/api/eval-sets/suggest", {
      method: "POST",
      body: JSON.stringify({ model, evalSetId: evalSet.id, options }),
    });
    setTask(created);
  }

  async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(path, { ...init, headers });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    if (!response.ok) {
      throw new Error((data as { error?: string }).error || "请求失败");
    }
    return data as T;
  }

  async function downloadSkill(path: string) {
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(path, { headers });
    if (!response.ok) throw new Error("下载失败");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "SKILL.md";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7f5] px-6 text-[#191b1f]">
        <section className="w-full max-w-md rounded-lg border border-[#d7ddd7] bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-[#8a3f2c]">Skill Self Evolution</p>
          <h1 className="mt-3 text-3xl font-semibold">进入工作台</h1>
          <p className="mt-3 text-sm leading-6 text-[#59616b]">
            输入 workspace password 后继续。这里不是账号系统，只是单租户访问门禁。
          </p>
          <input
            className="mt-6 w-full rounded-md border border-[#c8d0ca] px-3 py-3"
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void login();
            }}
            placeholder="Workspace password"
            type="password"
            value={password}
          />
          {authError && <p className="mt-3 text-sm text-[#b42318]">{authError}</p>}
          <button className="mt-5 w-full rounded-md bg-[#1f2933] px-4 py-3 font-semibold text-white" onClick={login}>
            进入
          </button>
          <a
            className="mt-3 block rounded-md border border-[#28715f] px-4 py-3 text-center text-sm font-semibold text-[#28715f]"
            href="/demos/skill-algorithm-evolution.html"
          >
            查看算法进化演示
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7f5] text-[#191b1f]">
      <header className="border-b border-[#d7ddd7] bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4">
          <div className="mr-auto">
            <p className="text-xs font-semibold uppercase text-[#8a3f2c]">Skill Self Evolution</p>
            <h1 className="text-xl font-semibold">自进化实验工作台</h1>
          </div>
          <a
            className="rounded-md bg-[#28715f] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1f5c4e]"
            href="/demos/skill-algorithm-evolution.html"
          >
            算法进化演示
          </a>
          <StatusPill label="当前 skill" value={skill.metadata.name || "未命名"} />
          <label className="text-sm">
            模型
            <select className="ml-2 rounded-md border border-[#c8d0ca] bg-white px-2 py-2" onChange={(event) => setModel(event.target.value)} value={model}>
              {models.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <TaskBadge task={task} />
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-2">
          {[
            ["skill", "当前 skill"],
            ["evalSets", "评测集"],
            ["evaluation", "运行评测"],
            ["evolution", "自进化实验"],
          ].map(([key, label]) => (
            <button
              className={`w-full rounded-md px-4 py-3 text-left text-sm font-semibold ${view === key ? "bg-[#1f2933] text-white" : "bg-white text-[#344054]"}`}
              key={key}
              onClick={() => setView(key as View)}
            >
              {label}
            </button>
          ))}
        </nav>
        <section>
          {view === "skill" && (
            <SkillPanel
              saveState={saveState}
              skill={skill}
              skillDraft={skillDraft}
              onChange={(value) => {
                setSkillDraft(value);
                setSaveState("保存中...");
              }}
              onUpload={uploadSkill}
              onDownload={() => downloadSkill("/api/workspace/skill/download")}
            />
          )}
          {view === "evalSets" && (
            <EvalSetPanel
              evalSet={evalSet}
              evalSetIndex={evalSetIndex}
              onCreate={createEvalSet}
              onDelete={deleteEvalSet}
              onGenerateCases={generateCases}
              onSave={saveEvalSet}
              onSelect={selectEvalSet}
            />
          )}
          {view === "evaluation" && (
            <EvaluationPanel
              currentTaskActive={Boolean(currentTaskActive)}
              evalSet={evalSet}
              evalSetIndex={evalSetIndex}
              model={model}
              onRun={startEvaluation}
              onScopeChange={setScope}
              onSelectEvalSet={selectEvalSet}
              onSelectRun={async (id) => setSelectedRun(await api(`/api/evaluation-runs?id=${id}`))}
              onPlanChange={setEvaluationPlan}
              onCreateEvalSet={createEvalSet}
              run={selectedRun}
              runs={runs}
              plan={evaluationPlan}
              scope={scope}
              skill={skill}
            />
          )}
          {view === "evolution" && (
            <EvolutionPanel
              config={evolutionConfig}
              currentTaskActive={Boolean(currentTaskActive)}
              evalSetIndex={evalSetIndex}
              experiment={selectedExperiment}
              experiments={experiments}
              environmentFiles={evolutionEnvironmentFiles}
              model={model}
              onConfigChange={setEvolutionConfig}
              onCreateEvalSet={createEvalSet}
              onEnvironmentFilesChange={setEvolutionEnvironmentFiles}
              onPlanChange={setEvolutionPlan}
              onSelectExperiment={async (id) =>
                setSelectedExperiment(await api(`/api/evolution-experiments?id=${id}`))
              }
              onStart={startEvolution}
              onDownloadCandidate={downloadSkill}
              plan={evolutionPlan}
              skill={skill}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#d7ddd7] bg-[#f6f7f5] px-3 py-2 text-xs">
      <span className="text-[#667085]">{label}</span>
      <span className="ml-2 font-semibold">{value}</span>
    </div>
  );
}

function TaskBadge({ task }: { task: TaskRecord | null }) {
  if (!task) return <StatusPill label="任务" value="空闲" />;
  const percent = Math.round((task.progress.completed / Math.max(task.progress.total, 1)) * 100);
  return <StatusPill label={task.status} value={`${percent}% ${task.progress.label}`} />;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#d7ddd7] bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function SkillPanel(props: {
  skill: CurrentSkill;
  skillDraft: string;
  saveState: string;
  onChange: (value: string) => void;
  onUpload: (file: File) => Promise<void>;
  onDownload: () => Promise<void>;
}) {
  return (
    <Panel title="当前 skill">
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-md bg-[#e8eeea] px-3 py-2">{props.saveState}</span>
        <button
          className="rounded-md bg-[#1f2933] px-3 py-2 font-semibold text-white"
          onClick={() => void props.onDownload()}
        >
          下载 SKILL.md
        </button>
        <label className="rounded-md border border-[#c8d0ca] px-3 py-2 font-semibold">
          上传 .md / zip
          <input className="hidden" type="file" accept=".md,.zip" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void props.onUpload(file);
          }} />
        </label>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <textarea className="h-[640px] rounded-md border border-[#c8d0ca] p-4 font-mono text-sm" value={props.skillDraft} onChange={(event) => props.onChange(event.target.value)} />
        <div className="h-[640px] overflow-auto rounded-md border border-[#c8d0ca] p-4">
          <MarkdownPreview content={props.skillDraft} />
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Info label="name" value={props.skill.metadata.name || "缺失"} />
        <Info label="description" value={props.skill.metadata.description || "缺失"} />
        <Info label="引用数量" value={String(props.skill.references.length)} />
      </div>
    </Panel>
  );
}

function EvalSetPanel(props: {
  evalSetIndex: EvalSetIndexItem[];
  evalSet: EvalSet | null;
  onSelect: (id: string) => Promise<void>;
  onCreate: (type: EvalSetType) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSave: (evalSet: EvalSet) => Promise<void>;
  onGenerateCases: (options: CaseSuggestionOptions) => Promise<void>;
}) {
  const evalSet = props.evalSet;
  const [newEvalSetType, setNewEvalSetType] = useState<EvalSetType>("trigger");
  const [suggestionOptions, setSuggestionOptions] = useState<
    Omit<CaseSuggestionOptions, "evalSetType">
  >({
    count: 3,
    difficulty: "mixed",
    focus: "typical",
    includeMemoryAndContext: true,
    includeNegativeCases: true,
    includeCompetingSkills: true,
  });
  return (
    <Panel title="评测集">
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          className="rounded-md border border-[#c8d0ca] bg-white px-3 py-2 text-sm"
          onChange={(event) => setNewEvalSetType(event.target.value as EvalSetType)}
          value={newEvalSetType}
        >
          {Object.entries(evalSetTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button className="rounded-md bg-[#1f2933] px-3 py-2 text-sm font-semibold text-white" onClick={() => void props.onCreate(newEvalSetType)}>新建评测集</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-2">
          {props.evalSetIndex.map((item) => (
            <div
              className={`flex items-center gap-2 rounded-md px-2 py-2 ${
                evalSet?.id === item.id ? "bg-[#e8eeea]" : "bg-[#f8faf9]"
              }`}
              key={item.id}
            >
              <button
                className={`min-w-0 flex-1 truncate text-left text-sm ${
                  evalSet?.id === item.id ? "font-semibold" : ""
                }`}
                onClick={() => void props.onSelect(item.id)}
              >
                <span className="block truncate">{item.name}</span>
                <span className="mt-1 block text-xs font-normal text-[#667085]">
                  {evalSetTypeLabels[item.type]}
                </span>
              </button>
              <button
                className="shrink-0 rounded border border-[#d7ddd7] px-2 py-1 text-xs text-[#b42318]"
                onClick={() => void props.onDelete(item.id)}
              >
                删除
              </button>
            </div>
          ))}
        </aside>
        {evalSet ? (
          <EvalSetEditor
            evalSet={evalSet}
            onGenerateCases={props.onGenerateCases}
            onSave={props.onSave}
            onSuggestionOptionsChange={setSuggestionOptions}
            suggestionOptions={suggestionOptions}
          />
        ) : (
          <div className="rounded-md border border-dashed border-[#c8d0ca] p-8 text-[#667085]">请选择或创建一个评测集。</div>
        )}
      </div>
    </Panel>
  );
}

function EvalSetEditor({
  evalSet,
  onGenerateCases,
  onSave,
  onSuggestionOptionsChange,
  suggestionOptions,
}: {
  evalSet: EvalSet;
  onGenerateCases: (options: CaseSuggestionOptions) => Promise<void>;
  onSave: (evalSet: EvalSet) => Promise<void>;
  onSuggestionOptionsChange: (
    options: Omit<CaseSuggestionOptions, "evalSetType">,
  ) => void;
  suggestionOptions: Omit<CaseSuggestionOptions, "evalSetType">;
}) {
  const generationType = evalSet.type || "trigger";
  const focusLabels = suggestionFocusLabels[generationType];

  function update(next: Partial<EvalSet>) {
    void onSave({ ...evalSet, ...next });
  }

  function updateSuggestionOptions(
    next: Partial<Omit<CaseSuggestionOptions, "evalSetType">>,
  ) {
    onSuggestionOptionsChange({ ...suggestionOptions, ...next });
  }

  return (
    <div className="space-y-5">
      <input className="w-full rounded-md border border-[#c8d0ca] px-3 py-2 text-lg font-semibold" value={evalSet.name} onChange={(event) => update({ name: event.target.value })} />
      <div className="inline-flex rounded-md bg-[#e8eeea] px-3 py-2 text-sm font-semibold text-[#28715f]">
        {evalSetTypeLabels[evalSet.type || "trigger"]}
      </div>
      <textarea className="w-full rounded-md border border-[#c8d0ca] px-3 py-2 text-sm" value={evalSet.description} placeholder="评测集描述" onChange={(event) => update({ description: event.target.value })} />
      <section className="border-y border-[#d7ddd7] bg-[#fbfcfb] py-4">
        <div className="mb-3 text-sm font-semibold text-[#33443f]">
          向当前评测集生成：{evalSetTypeLabels[generationType]}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            生成数量
            <input
              className="input mt-1 w-24"
              max={10}
              min={1}
              onChange={(event) =>
                updateSuggestionOptions({ count: Number(event.target.value) })
              }
              type="number"
              value={suggestionOptions.count}
            />
          </label>
          <label className="text-sm">
            难度
            <select
              className="input mt-1"
              onChange={(event) =>
                updateSuggestionOptions({
                  difficulty: event.target.value as CaseSuggestionOptions["difficulty"],
                })
              }
              value={suggestionOptions.difficulty}
            >
              <option value="basic">基础</option>
              <option value="mixed">混合</option>
              <option value="adversarial">对抗</option>
            </select>
          </label>
          <label className="text-sm">
            场景侧重
            <select
              className="input mt-1"
              onChange={(event) =>
                updateSuggestionOptions({
                  focus: event.target.value as CaseSuggestionOptions["focus"],
                })
              }
              value={suggestionOptions.focus}
            >
              {Object.entries(focusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="rounded-md border border-[#c8d0ca] px-3 py-2 text-sm font-semibold"
            onClick={() =>
              void onGenerateCases({
                ...suggestionOptions,
                evalSetType: generationType,
                includeCompetingSkills:
                  generationType === "trigger" && suggestionOptions.includeCompetingSkills,
              })
            }
          >
            AI 生成并写入
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <label>
            <input
              checked={suggestionOptions.includeMemoryAndContext}
              className="mr-2"
              onChange={(event) =>
                updateSuggestionOptions({
                  includeMemoryAndContext: event.target.checked,
                })
              }
              type="checkbox"
            />
            包含记忆和对话上下文
          </label>
          <label>
            <input
              checked={suggestionOptions.includeNegativeCases}
              className="mr-2"
              onChange={(event) =>
                updateSuggestionOptions({
                  includeNegativeCases: event.target.checked,
                })
              }
              type="checkbox"
            />
            {suggestionNegativeLabels[generationType]}
          </label>
          {generationType === "trigger" && (
            <label>
              <input
                checked={suggestionOptions.includeCompetingSkills}
                className="mr-2"
                onChange={(event) =>
                  updateSuggestionOptions({
                    includeCompetingSkills: event.target.checked,
                  })
                }
                type="checkbox"
              />
              包含竞争 skill list
            </label>
          )}
        </div>
      </section>
      {(evalSet.type || "trigger") === "trigger" ? (
        <CaseSection
          title="可触发性数据"
          cases={evalSet.routingCases}
          onAdd={() => update({ routingCases: [...evalSet.routingCases, { id: makeId("route_case"), name: "新的可触发性数据", prompt: "", memoryAndContext: "", expectedSkill: "" }] })}
          onChange={(routingCases) => update({ routingCases })}
          render={(item, set) => (
            <>
              <input className="input" placeholder="数据名称" value={item.name} onChange={(e) => set({ ...item, name: e.target.value })} />
              <textarea className="input" placeholder="用户输入" value={item.prompt} onChange={(e) => set({ ...item, prompt: e.target.value })} />
              <textarea className="input" placeholder="记忆和对话上下文" value={item.memoryAndContext || ""} onChange={(e) => set({ ...item, memoryAndContext: e.target.value })} />
              <textarea className="input" placeholder="其他 skill list，每行：name: description" value={formatCandidateSkillLines(item.candidateSkills || [])} onChange={(e) => set({ ...item, candidateSkills: parseCandidateSkillLines(e.target.value) })} />
              <input className="input" placeholder="期望触发的 skill name / none" value={item.expectedSkill} onChange={(e) => set({ ...item, expectedSkill: e.target.value })} />
            </>
          )}
        />
      ) : (
        <CaseSection
          title={evalSet.type === "agent_execution" ? "agent 实际执行效果数据" : "单 skill 预期执行效果数据"}
          cases={evalSet.executionCases}
          onAdd={() => update({ executionCases: [...evalSet.executionCases, { id: makeId("exec_case"), name: "新的效果数据", taskInput: "", memoryAndContext: "", expectedBehavior: "" }] })}
          onChange={(executionCases) => update({ executionCases })}
          render={(item, set) => (
            <>
              <input className="input" placeholder="数据名称" value={item.name} onChange={(e) => set({ ...item, name: e.target.value })} />
              <textarea className="input" placeholder="用户输入" value={item.taskInput} onChange={(e) => set({ ...item, taskInput: e.target.value })} />
              <textarea className="input" placeholder="记忆和对话上下文" value={item.memoryAndContext || ""} onChange={(e) => set({ ...item, memoryAndContext: e.target.value })} />
              <textarea className="input" placeholder="预期的执行结果" value={item.expectedResult || item.expectedBehavior} onChange={(e) => set({ ...item, expectedResult: e.target.value, expectedBehavior: e.target.value })} />
            </>
          )}
        />
      )}
    </div>
  );
}

function CaseSection<T extends RoutingCase | ExecutionCase>(props: {
  title: string;
  cases: T[];
  onAdd: () => void;
  onChange: (cases: T[]) => void;
  render: (item: T, set: (item: T) => void) => React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{props.title}</h3>
        <button className="rounded-md border border-[#c8d0ca] px-3 py-1 text-sm" onClick={props.onAdd}>添加</button>
      </div>
      <div className="space-y-3">
        {props.cases.map((item, index) => (
          <div className="rounded-md border border-[#d7ddd7] bg-[#fbfcfb] p-3" key={item.id}>
            <div className="flex justify-end">
              <button className="text-sm text-[#b42318]" onClick={() => props.onChange(props.cases.filter((_, caseIndex) => caseIndex !== index))}>移除</button>
            </div>
            <div className="grid gap-2">{props.render(item, (next) => props.onChange(props.cases.map((entry) => entry.id === item.id ? next : entry)))}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatCandidateSkillLines(skills: Array<{ name: string; description: string }>) {
  return skills.map((skill) => `${skill.name}: ${skill.description}`).join("\n");
}

function parseCandidateSkillLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":");
      if (separator === -1) return { name: line, description: "" };
      return {
        name: line.slice(0, separator).trim(),
        description: line.slice(separator + 1).trim(),
      };
    })
    .filter((skill) => skill.name);
}

function EvaluationPanel(props: {
  skill: CurrentSkill;
  evalSet: EvalSet | null;
  evalSetIndex: EvalSetIndexItem[];
  model: string;
  plan: EvaluationPlan;
  scope: EvaluationScope;
  runs: Array<{ id: string; score: number; createdAt: string }>;
  run: EvaluationRun | null;
  currentTaskActive: boolean;
  onCreateEvalSet: (type: EvalSetType) => Promise<void>;
  onScopeChange: (scope: EvaluationScope) => void;
  onPlanChange: (plan: EvaluationPlan) => void;
  onSelectEvalSet: (id: string) => Promise<void>;
  onRun: () => Promise<void>;
  onSelectRun: (id: string) => Promise<void>;
}) {
  const runnable = props.plan.staticReview ||
    Boolean(props.plan.triggerEvalSetId) ||
    Boolean(props.plan.singleSkillEvalSetId);

  return (
    <Panel title="运行评测">
      <div className="grid gap-3 md:grid-cols-2">
        <Info label="当前 skill" value={props.skill.content ? props.skill.metadata.name || "已加载" : "缺失"} />
        <Info label="模型" value={props.model || "未选择"} />
      </div>
      <div className="mt-4 grid gap-3">
        {visibleEvaluationScopes.map((item) => (
          <EvaluationPlanRow
            evalSetIndex={props.evalSetIndex}
            item={item}
            key={item.key}
            onCreateEvalSet={props.onCreateEvalSet}
            onPlanChange={props.onPlanChange}
            plan={props.plan}
          />
        ))}
      </div>
      <button className="mt-4 rounded-md bg-[#1f2933] px-4 py-3 font-semibold text-white disabled:opacity-50" disabled={props.currentTaskActive || !props.skill.content || !props.model || !runnable} onClick={props.onRun}>
        运行评测
      </button>
      <History items={props.runs} onSelect={props.onSelectRun} />
      {props.run && <EvaluationReport result={props.run.result} />}
    </Panel>
  );
}

function EvaluationPlanRow(props: {
  item: (typeof visibleEvaluationScopes)[number];
  evalSetIndex: EvalSetIndexItem[];
  onCreateEvalSet: (type: EvalSetType) => Promise<void>;
  plan: EvaluationPlan;
  onPlanChange: (plan: EvaluationPlan) => void;
}) {
  const { item, plan } = props;
  if (item.key === "staticReview") {
    return (
      <div className="rounded-md bg-[#f8faf9] px-3 py-3 text-sm">
        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={plan.staticReview}
            onChange={(event) =>
              props.onPlanChange({ ...plan, staticReview: event.target.checked })
            }
          />
          {item.label}
        </label>
        <div className="mt-3 grid gap-2 text-xs text-[#667085] sm:grid-cols-2">
          {staticReviewChecks.map((check) => (
            <div className="flex gap-2" key={check}>
              <span className="mt-[2px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#8aa398]" />
              <span>{check}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const selectedId = String(plan[item.key] || "");
  const enabled = Boolean(selectedId);
  const options = props.evalSetIndex.filter((evalSet) => evalSet.type === item.type);
  const unavailable = item.disabled || options.length === 0;
  return (
    <div className={`rounded-md bg-[#f8faf9] px-3 py-3 text-sm ${unavailable ? "opacity-60" : ""}`}>
      <label className="flex items-center gap-2">
        <input
          disabled={unavailable}
          type="checkbox"
          checked={enabled}
          onChange={(event) =>
            props.onPlanChange({
              ...plan,
              [item.key]: event.target.checked ? options[0]?.id || "" : undefined,
            })
          }
        />
        <span className="font-medium">{item.label}</span>
        {item.disabled && <span className="text-xs text-[#667085]">暂未接入真实 agent</span>}
      </label>
      {!item.disabled && options.length === 0 ? (
        <button
          className="mt-2 rounded-md border border-[#c8d0ca] px-3 py-2 text-sm font-semibold text-[#344054]"
          onClick={() => void props.onCreateEvalSet(item.type!)}
        >
          新建{evalSetTypeLabels[item.type!]}评测集
        </button>
      ) : (
        <select
          className="input mt-2 disabled:bg-[#eef2f6]"
          disabled={unavailable || !enabled}
          onChange={(event) =>
            props.onPlanChange({ ...plan, [item.key]: event.target.value || undefined })
          }
          value={selectedId}
        >
          <option value="">选择{item.label}评测集</option>
          {options.map((evalSet) => (
            <option key={evalSet.id} value={evalSet.id}>
              {evalSet.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function EvolutionPanel(props: {
  skill: CurrentSkill;
  evalSetIndex: EvalSetIndexItem[];
  model: string;
  config: EvolutionConfig;
  environmentFiles: EvolutionEnvironmentFile[];
  plan: EvaluationPlan;
  experiments: Array<{ id: string; strategy: string; candidates: number; createdAt: string }>;
  experiment: EvolutionExperiment | null;
  currentTaskActive: boolean;
  onConfigChange: (config: EvolutionConfig) => void;
  onCreateEvalSet: (type: EvalSetType) => Promise<void>;
  onEnvironmentFilesChange: (files: EvolutionEnvironmentFile[]) => void;
  onPlanChange: (plan: EvaluationPlan) => void;
  onStart: () => Promise<void>;
  onSelectExperiment: (id: string) => Promise<void>;
  onDownloadCandidate: (path: string) => Promise<void>;
}) {
  const cfg = props.config;
  const directImprove = cfg.strategy === "direct_improve";
  const candidatesPerRound = directImprove ? 1 : cfg.candidatesPerRound;
  const runnable = props.plan.staticReview ||
    Boolean(props.plan.triggerEvalSetId) ||
    Boolean(props.plan.singleSkillEvalSetId);

  async function addEnvironmentFiles(files: FileList | null) {
    if (!files?.length) return;
    const nextFiles = await Promise.all(
      Array.from(files).map(async (file) => ({
        id: makeId("env_file"),
        name: file.name,
        content: await file.text(),
        size: file.size,
        type: file.type || "text/plain",
      })),
    );
    props.onEnvironmentFilesChange([...props.environmentFiles, ...nextFiles]);
  }

  return (
    <Panel title="自进化实验">
      <Readiness
        evalSetIndex={props.evalSetIndex}
        model={props.model}
        plan={props.plan}
        skill={props.skill}
      />
      <section className="mt-5 rounded-md border border-[#d7ddd7] bg-[#fbfcfb] p-4">
        <div className="mb-3">
          <h3 className="font-semibold">评测器</h3>
          <p className="mt-1 text-sm text-[#667085]">
            自进化会先用这些评测器收集证据，再基于失败项和静态问题优化 SKILL.md。
          </p>
        </div>
        <div className="grid gap-3">
          {visibleEvaluationScopes.map((item) => (
            <EvaluationPlanRow
              evalSetIndex={props.evalSetIndex}
              item={item}
              key={item.key}
              onCreateEvalSet={props.onCreateEvalSet}
              onPlanChange={props.onPlanChange}
              plan={props.plan}
            />
          ))}
        </div>
      </section>
      <section className="mt-5">
        <h3 className="mb-3 font-semibold">进化策略</h3>
        <div>
          <p className="mb-2 text-sm font-semibold text-[#33443f]">进化算法</p>
          <div className="grid gap-3 lg:grid-cols-3">
            {evolutionAlgorithmOptions.map((option) => (
              <button
                className={`rounded-md border p-4 text-left ${getEvolutionAlgorithm(cfg) === option.key ? "border-[#1f2933] bg-[#e8eeea]" : "border-[#d7ddd7] bg-white"}`}
                key={option.key}
                onClick={() =>
                  props.onConfigChange({
                    ...cfg,
                    algorithm: option.key,
                  })
                }
              >
                <p className="font-semibold">{option.title}</p>
                <p className="mt-2 text-sm leading-6 text-[#667085]">
                  {option.description}
                </p>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold text-[#33443f]">生成模式</p>
          <div className="grid gap-4 lg:grid-cols-2">
            {evolutionGenerationModeOptions.map((option) => (
            <button
              className={`rounded-md border p-4 text-left ${cfg.strategy === option.key ? "border-[#1f2933] bg-[#e8eeea]" : "border-[#d7ddd7] bg-white"}`}
              key={option.key}
              onClick={() =>
                props.onConfigChange({
                  ...cfg,
                  strategy: option.key,
                  candidatesPerRound:
                    option.key === "direct_improve" ? 1 : cfg.candidatesPerRound,
                })
              }
            >
              <p className="font-semibold">{option.title}</p>
              <p className="mt-2 text-sm leading-6 text-[#667085]">
                {option.description}
              </p>
            </button>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="text-sm">轮次<input className="input mt-1" type="number" min={1} max={5} value={cfg.rounds} onChange={(e) => props.onConfigChange({ ...cfg, rounds: Number(e.target.value) })} /></label>
          <label className="text-sm">每轮候选<input className="input mt-1 disabled:bg-[#eef2f6] disabled:text-[#667085]" disabled={directImprove} type="number" min={1} max={3} value={candidatesPerRound} onChange={(e) => props.onConfigChange({ ...cfg, candidatesPerRound: Number(e.target.value) })} /></label>
          <label className="text-sm">优化偏好<select className="input mt-1" value={cfg.preference} onChange={(e) => props.onConfigChange({ ...cfg, preference: e.target.value as OptimizationPreference })}>
            <option value="balanced">Balanced</option>
            <option value="conservative">Conservative</option>
            <option value="aggressive">Aggressive</option>
            <option value="routing_focus">Routing Focus</option>
            <option value="execution_focus">Execution Focus</option>
            <option value="safety_focus">Safety Focus</option>
          </select></label>
        </div>
      </section>
      <section className="mt-5">
        <h3 className="mb-3 font-semibold">进化方向</h3>
        <textarea className="input" placeholder="可选：描述你希望这次进化更偏向什么目标" value={cfg.goal} onChange={(e) => props.onConfigChange({ ...cfg, goal: e.target.value })} />
      </section>
      <section className="mt-5 rounded-md border border-[#d7ddd7] bg-[#fbfcfb] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">进化环境</h3>
            <p className="mt-1 text-sm text-[#667085]">
              可上传多个参考文件，默认留空。文件会作为本次实验的参考上下文。
            </p>
          </div>
          <label className="rounded-md border border-[#c8d0ca] px-3 py-2 text-sm font-semibold">
            上传参考文件
            <input
              className="hidden"
              multiple
              onChange={(event) => {
                void addEnvironmentFiles(event.target.files);
                event.currentTarget.value = "";
              }}
              type="file"
            />
          </label>
        </div>
        {props.environmentFiles.length ? (
          <div className="mt-4 grid gap-2">
            {props.environmentFiles.map((file) => (
              <div
                className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm"
                key={file.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="text-xs text-[#667085]">{formatFileSize(file.size)}</p>
                </div>
                <button
                  className="rounded border border-[#d7ddd7] px-2 py-1 text-xs text-[#b42318]"
                  onClick={() =>
                    props.onEnvironmentFilesChange(
                      props.environmentFiles.filter((item) => item.id !== file.id),
                    )
                  }
                >
                  移除
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[#667085]">当前没有参考文件。</p>
        )}
      </section>
      <div className="mt-3 flex gap-4 text-sm">
        <label><input className="mr-2" type="checkbox" checked={cfg.lockName} onChange={(e) => props.onConfigChange({ ...cfg, lockName: e.target.checked })} />锁定 name</label>
        <label><input className="mr-2" type="checkbox" checked={cfg.lockDescription} onChange={(e) => props.onConfigChange({ ...cfg, lockDescription: e.target.checked })} />锁定 description</label>
      </div>
      <button className="mt-5 rounded-md bg-[#1f2933] px-4 py-3 font-semibold text-white disabled:opacity-50" disabled={props.currentTaskActive || !props.skill.content || !props.model || !runnable} onClick={props.onStart}>
        开始自进化实验
      </button>
      <History items={props.experiments} onSelect={props.onSelectExperiment} />
      {props.experiment && (
        <ExperimentReport
          experiment={props.experiment}
          onDownloadCandidate={props.onDownloadCandidate}
        />
      )}
    </Panel>
  );
}

function Readiness({
  evalSetIndex,
  model,
  plan,
  skill,
}: {
  evalSetIndex: EvalSetIndexItem[];
  model: string;
  plan: EvaluationPlan;
  skill: CurrentSkill;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Info label="当前 skill" value={skill.content ? skill.metadata.name || "已加载" : "缺失"} />
      <Info label="评测器" value={summarizeEvaluationPlan(plan, evalSetIndex)} />
      <Info label="模型" value={model || "未选择"} />
    </div>
  );
}

function summarizeEvaluationPlan(plan: EvaluationPlan, evalSetIndex: EvalSetIndexItem[]) {
  const selected: string[] = [];
  if (plan.staticReview) selected.push("静态质量");
  const trigger = evalSetIndex.find((item) => item.id === plan.triggerEvalSetId);
  if (trigger) selected.push(`触发：${trigger.name}`);
  const singleSkill = evalSetIndex.find((item) => item.id === plan.singleSkillEvalSetId);
  if (singleSkill) selected.push(`效果：${singleSkill.name}`);
  const agent = evalSetIndex.find((item) => item.id === plan.agentEvalSetId);
  if (agent) selected.push(`agent：${agent.name}`);
  return selected.length ? selected.join(" / ") : "未选择";
}

function summarizeExperimentPlan(experiment: EvolutionExperiment) {
  const selected: string[] = [];
  if (experiment.plan?.staticReview) selected.push("静态质量");
  if (experiment.evalSetSnapshots?.trigger) {
    selected.push(`触发：${experiment.evalSetSnapshots.trigger.name}`);
  }
  if (experiment.evalSetSnapshots?.singleSkillExecution) {
    selected.push(`效果：${experiment.evalSetSnapshots.singleSkillExecution.name}`);
  }
  if (experiment.evalSetSnapshots?.agentExecution) {
    selected.push(`agent：${experiment.evalSetSnapshots.agentExecution.name}`);
  }
  if (!selected.length && experiment.evalSetSnapshot) {
    selected.push(`旧版评测集：${experiment.evalSetSnapshot.name}`);
  }
  return selected.length ? selected.join(" / ") : "未记录";
}

function getEvolutionAlgorithm(config: EvolutionConfig): EvolutionAlgorithm {
  return config.algorithm || "llm_self_optimize";
}

function getEvolutionAlgorithmLabel(config: EvolutionConfig) {
  return (
    evolutionAlgorithmOptions.find((option) => option.key === getEvolutionAlgorithm(config))
      ?.title || "LLM 自优化"
  );
}

function getEvolutionGenerationModeLabel(config: EvolutionConfig) {
  return (
    evolutionGenerationModeOptions.find((option) => option.key === config.strategy)?.title ||
    config.strategy
  );
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function History<T extends { id: string; createdAt: string }>(props: { items: T[]; onSelect: (id: string) => Promise<void> }) {
  if (!props.items.length) return null;
  return (
    <div className="mt-6">
      <h3 className="mb-2 font-semibold">历史记录</h3>
      <div className="flex flex-wrap gap-2">
        {props.items.map((item) => (
          <button className="rounded-md border border-[#d7ddd7] px-3 py-2 text-sm" key={item.id} onClick={() => void props.onSelect(item.id)}>
            {new Date(item.createdAt).toLocaleString()}
          </button>
        ))}
      </div>
    </div>
  );
}

function EvaluationReport({ result }: { result: EvaluationRun["result"] }) {
  return (
    <div className="mt-6 rounded-md border border-[#d7ddd7] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-3xl font-semibold">{result.score}</p>
        <p className="text-sm text-[#667085]">{result.summary}</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {result.dimensions.map((item) => <Info key={item.name} label={item.name} value={String(item.score)} />)}
      </div>
      <ReportSection title="静态 findings" items={[...result.staticFindings, ...result.evalSetFindings].map((item) => `${item.severity}: ${item.message}`)} />
      <ReportSection title="触发评测" items={result.routingResults.map((item) => `${item.status}: ${item.caseName} -> ${item.actualSkill}`)} />
      <ReportSection title="效果评测" items={result.executionResults.map((item) => `${item.status}: ${item.caseName} - ${item.reason}`)} />
      <Info label="Token 用量" value={`${result.usage.totalTokens} tokens / ${result.usage.calls} calls`} />
    </div>
  );
}

function ExperimentReport({
  experiment,
  onDownloadCandidate,
}: {
  experiment: EvolutionExperiment;
  onDownloadCandidate: (path: string) => Promise<void>;
}) {
  const [selectedNodeId, setSelectedNodeId] = useState("root");
  const tree = buildEvolutionTree(experiment);
  const selectedCandidate =
    experiment.candidates.find((candidate) => candidate.id === selectedNodeId) || null;
  const originalDiff = selectedCandidate
    ? unifiedDiff(experiment.skillSnapshot, selectedCandidate.content)
    : "";

  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-3 md:grid-cols-6">
        <Info label="候选数量" value={String(experiment.candidates.length)} />
        <Info label="进化算法" value={getEvolutionAlgorithmLabel(experiment.config)} />
        <Info label="生成模式" value={getEvolutionGenerationModeLabel(experiment.config)} />
        <Info label="评测器" value={summarizeExperimentPlan(experiment)} />
        <Info label="进化环境" value={`${experiment.environmentFiles?.length || 0} 个文件`} />
        <Info label="Token 用量" value={`${experiment.usage.totalTokens} tokens`} />
      </div>
      <section className="rounded-md border border-[#d7ddd7] bg-[#fbfcfb] p-4">
        <h3 className="font-semibold">演进树</h3>
        <div className="mt-4">
          <EvolutionTree
            node={tree}
            selectedNodeId={selectedNodeId}
            onSelect={setSelectedNodeId}
          />
        </div>
      </section>
      <section className="rounded-md border border-[#d7ddd7] bg-white p-4">
        {selectedCandidate ? (
          <CandidateDetail
            candidate={selectedCandidate}
            experimentId={experiment.id}
            originalDiff={originalDiff}
            onDownloadCandidate={onDownloadCandidate}
          />
        ) : (
          <OriginalSkillDetail content={experiment.skillSnapshot} />
        )}
      </section>
    </div>
  );
}

type EvolutionCandidate = EvolutionExperiment["candidates"][number];

type EvolutionTreeNode = {
  id: string;
  label: string;
  candidate?: EvolutionCandidate;
  children: EvolutionTreeNode[];
};

function buildEvolutionTree(experiment: EvolutionExperiment): EvolutionTreeNode {
  const root: EvolutionTreeNode = {
    id: "root",
    label: "原始 skill",
    children: [],
  };
  const byId = new Map<string, EvolutionTreeNode>();

  for (const candidate of experiment.candidates) {
    byId.set(candidate.id, {
      id: candidate.id,
      label: candidate.label,
      candidate,
      children: [],
    });
  }

  for (const candidate of experiment.candidates) {
    const node = byId.get(candidate.id);
    if (!node) continue;
    const parent = candidate.parentCandidateId
      ? byId.get(candidate.parentCandidateId) || root
      : root;
    parent.children.push(node);
  }

  sortEvolutionTree(root);
  return root;
}

function sortEvolutionTree(node: EvolutionTreeNode) {
  node.children.sort((a, b) => {
    const roundDelta = (a.candidate?.round || 0) - (b.candidate?.round || 0);
    if (roundDelta !== 0) return roundDelta;
    return a.label.localeCompare(b.label);
  });
  for (const child of node.children) sortEvolutionTree(child);
}

function EvolutionTree({
  node,
  selectedNodeId,
  onSelect,
  depth = 0,
}: {
  node: EvolutionTreeNode;
  selectedNodeId: string;
  onSelect: (id: string) => void;
  depth?: number;
}) {
  const candidate = node.candidate;
  const active = selectedNodeId === node.id;
  return (
    <div>
      <button
        className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${
          active ? "border-[#1f2933] bg-[#e8eeea]" : "border-[#d7ddd7] bg-white"
        }`}
        onClick={() => onSelect(node.id)}
        style={{ marginLeft: depth ? 14 : 0, width: depth ? `calc(100% - ${depth * 14}px)` : "100%" }}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            {candidate ? `Round ${candidate.round} · ${node.label}` : node.label}
          </span>
          {candidate?.selectedForNextRound && (
            <span className="mt-1 block text-xs text-[#28715f]">进入下一轮</span>
          )}
        </span>
        {!candidate && (
          <span className="rounded-md bg-[#eef2f6] px-2 py-1 text-xs font-semibold text-[#475467]">
            原始
          </span>
        )}
      </button>
      {candidate && (
        <div
          className={`mt-2 grid gap-2 rounded-md border p-2 sm:grid-cols-2 lg:grid-cols-4 ${
            active ? "border-[#1f2933] bg-white" : "border-[#d7ddd7] bg-[#fbfcfb]"
          }`}
          style={{ marginLeft: depth ? 14 : 0, width: depth ? `calc(100% - ${depth * 14}px)` : "100%" }}
        >
          {candidate.evaluation.dimensions.map((dimension) => (
            <DimensionScoreBadge
              key={dimension.name}
              name={dimension.name}
              score={dimension.score}
            />
          ))}
        </div>
      )}
      {node.children.length > 0 && (
        <div className="ml-3 mt-2 space-y-2 border-l border-[#d7ddd7] pl-3">
          {node.children.map((child) => (
            <EvolutionTree
              depth={depth + 1}
              key={child.id}
              node={child}
              onSelect={onSelect}
              selectedNodeId={selectedNodeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CandidateDetail({
  candidate,
  experimentId,
  originalDiff,
  onDownloadCandidate,
}: {
  candidate: EvolutionCandidate;
  experimentId: string;
  originalDiff: string;
  onDownloadCandidate: (path: string) => Promise<void>;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-sm text-[#667085]">Round {candidate.round}</p>
          <h3 className="text-lg font-semibold">{candidate.label}</h3>
        </div>
        <span className={`rounded-md px-3 py-2 text-sm font-semibold ${scoreClass(candidate.evaluation.score)}`}>
          {candidate.evaluation.score} 分
        </span>
        {candidate.selectedForNextRound && (
          <span className="rounded-md bg-[#e8eeea] px-3 py-2 text-sm font-semibold text-[#28715f]">
            进入下一轮
          </span>
        )}
      </div>
      <p className="mt-3 text-sm leading-6 text-[#344054]">{candidate.changeSummary}</p>
      {candidate.selectorReason && (
        <p className="mt-2 rounded-md bg-[#f8faf9] p-3 text-sm text-[#667085]">
          {candidate.selectorReason}
        </p>
      )}
      <button
        className="mt-4 rounded-md bg-[#1f2933] px-3 py-2 text-sm font-semibold text-white"
        onClick={() =>
          void onDownloadCandidate(
            `/api/evolution-experiments/${experimentId}/candidates/${candidate.id}/download`,
          )
        }
      >
        下载 SKILL.md
      </button>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section>
          <h4 className="mb-2 font-semibold">相对原始 skill 的 diff</h4>
          <DiffViewer diff={originalDiff} />
        </section>
        <section>
          <h4 className="mb-2 font-semibold">候选 SKILL.md</h4>
          <div className="max-h-[520px] overflow-auto rounded-md border border-[#d7ddd7] bg-white p-4">
            <MarkdownPreview content={candidate.content} />
          </div>
        </section>
      </div>
      <EvaluationReport result={candidate.evaluation} />
    </div>
  );
}

function OriginalSkillDetail({ content }: { content: string }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold">原始 skill</h3>
        <span className="rounded-md bg-[#eef2f6] px-3 py-2 text-sm font-semibold text-[#475467]">
          baseline
        </span>
      </div>
      <div className="mt-4 max-h-[640px] overflow-auto rounded-md border border-[#d7ddd7] bg-white p-4">
        <MarkdownPreview content={content} />
      </div>
    </div>
  );
}

function scoreClass(score: number) {
  if (score >= 80) return "bg-[#e8f3ee] text-[#28715f]";
  if (score >= 60) return "bg-[#fff4dd] text-[#8a5a00]";
  return "bg-[#fdecec] text-[#b42318]";
}

function DimensionScoreBadge({ name, score }: { name: string; score: number }) {
  return (
    <div className="rounded-md bg-[#f8faf9] px-2 py-2">
      <p className="truncate text-[11px] text-[#667085]">{name}</p>
      <p className={`mt-1 inline-block rounded px-2 py-1 text-xs font-semibold ${scoreClass(score)}`}>
        {score}
      </p>
    </div>
  );
}

function DiffViewer({ diff }: { diff: string }) {
  const lines = diff ? diff.split("\n") : ["无变化"];
  return (
    <div className="max-h-[560px] overflow-auto rounded-md border border-[#d7ddd7] bg-[#101828] py-2 font-mono text-xs leading-5">
      {lines.map((line, index) => {
        const kind = line.startsWith("+ ")
          ? "added"
          : line.startsWith("- ")
            ? "removed"
            : "context";
        const content = line.startsWith("+ ") || line.startsWith("- ") || line.startsWith("  ")
          ? line.slice(2)
          : line;
        return (
          <div
            className={`grid grid-cols-[56px_24px_minmax(0,1fr)] px-3 ${
              kind === "added"
                ? "bg-[#123b2a] text-[#d3f8df]"
                : kind === "removed"
                  ? "bg-[#4a1f1f] text-[#ffd6d6]"
                  : "text-[#d0d5dd]"
            }`}
            key={`${index}-${line}`}
          >
            <span className="select-none text-right text-[#98a2b3]">{index + 1}</span>
            <span className="select-none text-center">
              {kind === "added" ? "+" : kind === "removed" ? "-" : ""}
            </span>
            <span className="min-w-0 whitespace-pre-wrap break-words">
              {content}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function parseGeneratedEvalSet(value: unknown): EvalSet | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "updatedEvalSet" in value
  ) {
    const updatedEvalSet = (value as { updatedEvalSet?: unknown }).updatedEvalSet;
    if (
      typeof updatedEvalSet === "object" &&
      updatedEvalSet !== null &&
      "id" in updatedEvalSet &&
      "type" in updatedEvalSet
    ) {
      return updatedEvalSet as EvalSet;
    }
  }
  return null;
}

function MarkdownPreview({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || "暂无内容"}</ReactMarkdown>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#e8eeea] px-3 py-2">
      <p className="text-xs text-[#667085]">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ReportSection({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-4">
      <h4 className="font-semibold">{title}</h4>
      <ul className="mt-2 space-y-1 text-sm text-[#344054]">
        {items.map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </section>
  );
}
