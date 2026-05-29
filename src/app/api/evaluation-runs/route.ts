import { after } from "next/server";
import { createArkClient } from "@/lib/server/ark";
import { getEvalSet } from "@/lib/server/eval-sets";
import {
  getEvaluationRun,
  getEvaluationPlanStepTotal,
  listEvaluationRuns,
  runEvaluation,
  saveEvaluationRun,
} from "@/lib/server/evaluators";
import { readJson, withAuth } from "@/lib/server/http";
import { createTask, failTask, updateTask } from "@/lib/server/tasks";
import { getCurrentSkill } from "@/lib/server/workspace";
import type { EvaluationPlan, EvaluationScope } from "@/lib/types";

export const maxDuration = 800;

export async function GET(request: Request) {
  return withAuth(request, async () => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) return Response.json(await getEvaluationRun(id));
    return Response.json(await listEvaluationRuns());
  });
}

export async function POST(request: Request) {
  return withAuth(request, async () => {
    const body = await readJson<{
      model: string;
      evalSetId?: string;
      scope: EvaluationScope;
      plan?: EvaluationPlan;
    }>(request);
    const task = await createTask("evaluation_run", 1);
    after(async () => {
      try {
        const skill = await getCurrentSkill();
        const evalSet = body.evalSetId ? await getEvalSet(body.evalSetId) : undefined;
        const triggerEvalSet = body.plan?.triggerEvalSetId
          ? await getEvalSet(body.plan.triggerEvalSetId)
          : undefined;
        const singleSkillEvalSet = body.plan?.singleSkillEvalSetId
          ? await getEvalSet(body.plan.singleSkillEvalSetId)
          : undefined;
        const agentEvalSet = body.plan?.agentEvalSetId
          ? await getEvalSet(body.plan.agentEvalSetId)
          : undefined;
        const effectiveScope = body.plan
          ? {
              generalStatic: body.plan.staticReview,
              evalSetFit: false,
              routing: Boolean(body.plan.triggerEvalSetId),
              execution: Boolean(body.plan.singleSkillEvalSetId),
            }
          : body.scope;
        const total = getEvaluationPlanStepTotal({
          scope: effectiveScope,
          evalSet: evalSet || undefined,
          triggerEvalSet: triggerEvalSet || undefined,
          singleSkillEvalSet: singleSkillEvalSet || undefined,
          agentEvalSet: agentEvalSet || undefined,
          plan: body.plan,
        });
        await updateTask(task.id, {
          status: "running",
          progress: { completed: 0, total, label: "准备评测" },
        });
        const result = await runEvaluation(
          {
            skill: skill.content,
            evalSet: evalSet || undefined,
            triggerEvalSet: triggerEvalSet || undefined,
            singleSkillEvalSet: singleSkillEvalSet || undefined,
            agentEvalSet: agentEvalSet || undefined,
            model: body.model,
            scope: effectiveScope,
            plan: body.plan,
          },
          createArkClient(body.model),
          {
            onProgress: async (progress) => {
              await updateTask(task.id, {
                status: "running",
                progress,
              });
            },
          },
        );
        const run = await saveEvaluationRun({
          model: body.model,
          scope: effectiveScope,
          plan: body.plan,
          skillSnapshot: skill.content,
          evalSetSnapshot: evalSet || undefined,
          evalSetSnapshots: {
            trigger: triggerEvalSet || undefined,
            singleSkillExecution: singleSkillEvalSet || undefined,
            agentExecution: agentEvalSet || undefined,
          },
          result,
        });
        await updateTask(task.id, {
          status: "succeeded",
          resultRef: `runs/${run.id}/result.json`,
          progress: { completed: 1, total: 1, label: "已完成" },
        });
      } catch (error) {
        await failTask(task.id, error instanceof Error ? error.message : "评测失败");
      }
    });
    return Response.json(task);
  });
}
