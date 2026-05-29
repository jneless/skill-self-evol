import { getJsonObject } from "@/lib/server/storage";
import { withAuth } from "@/lib/server/http";
import { getTask } from "@/lib/server/tasks";

export async function GET(request: Request, context: RouteContext<"/api/tasks/[id]">) {
  return withAuth(request, async () => {
    const { id } = await context.params;
    const task = await getTask(id);
    const result = task?.resultRef ? await getJsonObject(task.resultRef, null) : null;
    return Response.json({ task, result });
  });
}
