import { after } from "next/server";
import { createArkClient } from "@/lib/server/ark";
import { getCurrentSkill } from "@/lib/server/workspace";
import { getEvalSet, saveEvalSet } from "@/lib/server/eval-sets";
import { withAuth } from "@/lib/server/http";
import { createTask, failTask, updateTask } from "@/lib/server/tasks";
import { suggestCases } from "@/lib/server/evaluators";
import { putJsonObject } from "@/lib/server/storage";
import type { CaseSuggestionOptions } from "@/lib/types";

export const maxDuration = 300;

export async function POST(request: Request) {
  return withAuth(request, async () => {
    const body = (await request.json()) as {
      model: string;
      evalSetId?: string;
      options?: CaseSuggestionOptions;
    };
    const options: CaseSuggestionOptions = {
      evalSetType: body.options?.evalSetType || "trigger",
      count: Math.max(1, Math.min(body.options?.count || 3, 10)),
      difficulty: body.options?.difficulty || "mixed",
      focus: body.options?.focus || "typical",
      includeMemoryAndContext: body.options?.includeMemoryAndContext ?? true,
      includeNegativeCases: body.options?.includeNegativeCases ?? true,
      includeCompetingSkills: body.options?.includeCompetingSkills ?? true,
    };
    const task = await createTask("case_suggestion", 1);
    after(async () => {
      try {
        await updateTask(task.id, {
          status: "running",
          progress: { completed: 0, total: 1, label: "生成并写入评测集" },
        });
        const skill = await getCurrentSkill();
        const evalSet = body.evalSetId ? await getEvalSet(body.evalSetId) : null;
        if (!evalSet) throw new Error("请先选择一个评测集");
        const result = await suggestCases(
          skill.content,
          body.model,
          createArkClient(body.model),
          options,
        );
        const updatedEvalSet =
          (evalSet.type || "trigger") === "trigger"
            ? await saveEvalSet({
                ...evalSet,
                routingCases: [...evalSet.routingCases, ...result.routingCases],
              })
            : await saveEvalSet({
                ...evalSet,
                executionCases: [...evalSet.executionCases, ...result.executionCases],
              });
        await putJsonObject(`tasks/${task.id}/result.json`, {
          generated: result,
          updatedEvalSet,
        });
        await updateTask(task.id, {
          status: "succeeded",
          resultRef: `tasks/${task.id}/result.json`,
          progress: { completed: 1, total: 1, label: "已写入评测集" },
        });
      } catch (error) {
        await failTask(task.id, error instanceof Error ? error.message : "生成失败");
      }
    });
    return Response.json(task);
  });
}
