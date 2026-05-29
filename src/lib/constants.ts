import type { EvaluatorVersions } from "./types";

export const evaluatorVersions: EvaluatorVersions = {
  staticReview: "static-review-v1",
  evalSetFit: "eval-set-fit-v1",
  routingSimulation: "routing-sim-v1",
  executionSimulation: "execution-sim-v1",
  caseSuggestion: "case-suggestion-v1",
  evolutionDirect: "direct-improve-v1",
  evolutionDiverse: "diverse-candidates-v1",
  candidateSelector: "candidate-selector-v1",
};

export const defaultCompetitionPool = [
  {
    name: "writing-plans",
    description:
      "Use when requirements are known and an implementation plan should be written before code changes.",
  },
  {
    name: "brainstorming",
    description:
      "Use before creative product or feature work to clarify intent, constraints, and design.",
  },
  {
    name: "github-review",
    description:
      "Use when reviewing pull requests, focusing on defects, regressions, risks, and missing tests.",
  },
  {
    name: "lark-doc",
    description:
      "Use for reading, editing, summarizing, or creating Lark/Feishu documents.",
  },
];

export const emptyUsage = (model: string) => ({
  model,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  calls: 0,
  durationMs: 0,
});
