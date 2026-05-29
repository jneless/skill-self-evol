export type Severity = "critical" | "major" | "minor";
export type CaseStatus = "pass" | "partial" | "fail";
export type TaskStatus = "queued" | "running" | "succeeded" | "failed";
export type TaskKind =
  | "case_suggestion"
  | "evaluation_run"
  | "evolution_experiment";

export type EvaluationScope = {
  generalStatic: boolean;
  evalSetFit: boolean;
  routing: boolean;
  execution: boolean;
};

export type EvalSetType =
  | "trigger"
  | "single_skill_execution"
  | "agent_execution";

export type EvaluationPlan = {
  staticReview: boolean;
  triggerEvalSetId?: string;
  singleSkillEvalSetId?: string;
  agentEvalSetId?: string;
};

export type CaseSuggestionDifficulty = "basic" | "mixed" | "adversarial";
export type CaseSuggestionFocus = "typical" | "boundary" | "negative" | "regression";

export type CaseSuggestionOptions = {
  evalSetType: EvalSetType;
  count: number;
  difficulty: CaseSuggestionDifficulty;
  focus: CaseSuggestionFocus;
  includeMemoryAndContext: boolean;
  includeNegativeCases: boolean;
  includeCompetingSkills: boolean;
};

export type ParsedSkillMetadata = {
  name?: string;
  description?: string;
  frontmatter: Record<string, unknown>;
  body: string;
  parseError?: string;
};

export type SkillReference = {
  path: string;
  kind: "references" | "scripts" | "assets" | "templates" | "other";
  status: "unknown" | "present" | "missing";
};

export type CurrentSkill = {
  content: string;
  metadata: ParsedSkillMetadata;
  references: SkillReference[];
  sourceType: "empty" | "paste" | "md_upload" | "zip_upload";
  sourceFileName?: string;
  updatedAt?: string;
};

export type ZipManifest = {
  sourceType: "zip";
  skillMdPath: "SKILL.md";
  files: string[];
  extractedAt: string;
};

export type RoutingCase = {
  id: string;
  name: string;
  prompt: string;
  memoryAndContext?: string;
  expectedSkill: string;
  expectedNone?: boolean;
  candidateSkills?: CandidateSkillDescription[];
  rationale?: string;
  confusingSkills?: string;
  notes?: string;
};

export type ExecutionCase = {
  id: string;
  name: string;
  taskInput: string;
  memoryAndContext?: string;
  expectedBehavior: string;
  expectedResult?: string;
  rubric?: string;
  forbiddenBehavior?: string;
  optionalContext?: string;
  notes?: string;
};

export type EvalSet = {
  id: string;
  type: EvalSetType;
  name: string;
  description: string;
  routingCases: RoutingCase[];
  executionCases: ExecutionCase[];
  createdAt: string;
  updatedAt: string;
};

export type CandidateSkillDescription = {
  name: string;
  description: string;
};

export type StaticFinding = {
  id: string;
  severity: Severity;
  dimension: string;
  message: string;
  evidenceSnippet?: string;
  suggestedFix?: string;
};

export type RoutingCaseResult = {
  caseId: string;
  caseName: string;
  status: CaseStatus;
  severity: Severity;
  expectedSkill: string;
  actualSkill: string;
  reason: string;
  evidence?: string;
  suggestedFix?: string;
};

export type ExecutionCaseResult = {
  caseId: string;
  caseName: string;
  status: CaseStatus;
  severity: Severity;
  simulatedOutput: string;
  reason: string;
  evidence?: string;
  suggestedFix?: string;
};

export type DimensionScore = {
  name: string;
  score: number;
};

export type LlmUsage = {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  calls: number;
  durationMs: number;
};

export type EvaluatorVersions = {
  staticReview: string;
  evalSetFit: string;
  routingSimulation: string;
  executionSimulation: string;
  caseSuggestion: string;
  evolutionDirect: string;
  evolutionDiverse: string;
  candidateSelector: string;
};

export type EvaluationResult = {
  summary: string;
  score: number;
  dimensions: DimensionScore[];
  staticFindings: StaticFinding[];
  evalSetFindings: StaticFinding[];
  routingResults: RoutingCaseResult[];
  executionResults: ExecutionCaseResult[];
  usage: LlmUsage;
  evaluatorVersions: EvaluatorVersions;
};

export type EvaluationRun = {
  id: string;
  model: string;
  scope: EvaluationScope;
  plan?: EvaluationPlan;
  skillSnapshot: string;
  evalSetSnapshot?: EvalSet;
  evalSetSnapshots?: {
    trigger?: EvalSet;
    singleSkillExecution?: EvalSet;
    agentExecution?: EvalSet;
  };
  result: EvaluationResult;
  createdAt: string;
};

export type EvolutionStrategy =
  | "direct_improve"
  | "diverse_candidates"
  | "bio_inspired";

export type EvolutionAlgorithm =
  | "llm_self_optimize"
  | "genetic"
  | "particle_swarm"
  | "ant_colony"
  | "immune_clonal"
  | "simulated_annealing";

export type OptimizationPreference =
  | "balanced"
  | "conservative"
  | "aggressive"
  | "routing_focus"
  | "execution_focus"
  | "safety_focus";

export type EvolutionConfig = {
  algorithm?: EvolutionAlgorithm;
  strategy: EvolutionStrategy;
  rounds: number;
  candidatesPerRound: number;
  preference: OptimizationPreference;
  goal?: string;
  lockName: boolean;
  lockDescription: boolean;
};

export type EvolutionEnvironmentFile = {
  id: string;
  name: string;
  content: string;
  size: number;
  type?: string;
};

export type EvolutionCandidate = {
  id: string;
  round: number;
  label: string;
  parentCandidateId?: string;
  content: string;
  changeSummary: string;
  diff: string;
  selectedForNextRound: boolean;
  selectorReason?: string;
  evaluation: EvaluationResult;
};

export type EvolutionExperiment = {
  id: string;
  model: string;
  config: EvolutionConfig;
  plan?: EvaluationPlan;
  skillSnapshot: string;
  evalSetSnapshot?: EvalSet;
  evalSetSnapshots?: {
    trigger?: EvalSet;
    singleSkillExecution?: EvalSet;
    agentExecution?: EvalSet;
  };
  environmentFiles?: EvolutionEnvironmentFile[];
  candidates: EvolutionCandidate[];
  usage: LlmUsage;
  createdAt: string;
};

export type TaskProgress = {
  completed: number;
  total: number;
  label: string;
};

export type TaskRecord = {
  id: string;
  kind: TaskKind;
  status: TaskStatus;
  progress: TaskProgress;
  resultRef?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type SuggestedCasesResult = {
  routingCases: RoutingCase[];
  executionCases: ExecutionCase[];
  usage: LlmUsage;
};
