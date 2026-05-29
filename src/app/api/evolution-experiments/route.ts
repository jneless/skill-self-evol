import { after } from "next/server";
import { createArkClient } from "@/lib/server/ark";
import { getEvalSet } from "@/lib/server/eval-sets";
import {
  getEvolutionExperiment,
  listEvolutionExperiments,
  runEvolutionExperiment,
} from "@/lib/server/evolution";
import { readJson, withAuth } from "@/lib/server/http";
import { createTask, failTask, updateTask } from "@/lib/server/tasks";
import { getCurrentSkill } from "@/lib/server/workspace";
import type {
  EvaluationPlan,
  EvolutionConfig,
  EvolutionEnvironmentFile,
} from "@/lib/types";

export const maxDuration = 1200;

export async function GET(request: Request) {
  return withAuth(request, async () => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) return Response.json(await getEvolutionExperiment(id));
    return Response.json(await listEvolutionExperiments());
  });
}

export async function POST(request: Request) {
  return withAuth(request, async () => {
    const body = await readJson<{
      model: string;
      evalSetId?: string;
      config: EvolutionConfig;
      plan?: EvaluationPlan;
      environmentFiles?: EvolutionEnvironmentFile[];
    }>(request);
    const task = await createTask("evolution_experiment", 1);
    after(async () => {
      try {
        await updateTask(task.id, {
          status: "running",
          progress: { completed: 0, total: 1, label: "运行自进化实验" },
        });
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
        const experiment = await runEvolutionExperiment(
          {
            skill: skill.content,
            evalSet: evalSet || undefined,
            triggerEvalSet: triggerEvalSet || undefined,
            singleSkillEvalSet: singleSkillEvalSet || undefined,
            agentEvalSet: agentEvalSet || undefined,
            model: body.model,
            config: body.config,
            plan: body.plan,
            environmentFiles: body.environmentFiles || [],
          },
          createArkClient(body.model),
        );
        await updateTask(task.id, {
          status: "succeeded",
          resultRef: `experiments/${experiment.id}/result.json`,
          progress: { completed: 1, total: 1, label: "已完成" },
        });
      } catch (error) {
        await failTask(task.id, error instanceof Error ? error.message : "自进化失败");
      }
    });
    return Response.json(task);
  });
}
