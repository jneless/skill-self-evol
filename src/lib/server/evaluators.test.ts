import { describe, expect, it } from "vitest";
import { runEvaluation } from "./evaluators";
import type { LlmClient } from "./ark";

const fakeLlm: LlmClient = {
  async complete(messages) {
    const text = messages.map((message) => message.content).join("\n");
    const content = text.includes("router")
      ? JSON.stringify({
          actualSkill: "review",
          status: "pass",
          reason: "匹配 code review 场景",
        })
      : text.includes("judge")
        ? JSON.stringify({
            status: "partial",
            reason: "输出方向正确，但缺少文件行号",
            evidence: "missing line refs",
            suggestedFix: "要求输出文件行号",
          })
        : "模拟输出";
    return {
      content,
      usage: {
        model: "fake",
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        calls: 1,
        durationMs: 1,
      },
    };
  },
};

describe("runEvaluation", () => {
  it("combines static, routing, and execution evidence", async () => {
    const progress: Array<{ completed: number; total: number; label: string }> = [];
    const result = await runEvaluation(
      {
        skill: `---
name: review
description: Use when reviewing code changes.
---

## Steps
Review findings first.

Do not modify files.`,
        model: "fake",
        scope: {
          generalStatic: true,
          evalSetFit: true,
          routing: true,
          execution: true,
        },
        evalSet: {
          id: "eval",
          type: "trigger",
          name: "Review eval",
          description: "",
          createdAt: "now",
          updatedAt: "now",
          routingCases: [
            {
              id: "r1",
              name: "review trigger",
              prompt: "please review this diff",
              expectedSkill: "review",
            },
          ],
          executionCases: [
            {
              id: "e1",
              name: "review output",
              taskInput: "review this PR",
              expectedBehavior: "findings first",
            },
          ],
        },
      },
      fakeLlm,
      {
        onProgress: (item) => {
          progress.push(item);
        },
      },
    );

    expect(result.routingResults[0].status).toBe("pass");
    expect(result.executionResults[0].status).toBe("partial");
    expect(result.usage.calls).toBeGreaterThan(0);
    expect(progress.some((item) => item.label.startsWith("触发评测"))).toBe(true);
    expect(progress.at(-1)).toMatchObject({ completed: 4, total: 4 });
  });
});
