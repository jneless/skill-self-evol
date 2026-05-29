import { deleteEvalSet, getEvalSet, saveEvalSet } from "@/lib/server/eval-sets";
import { readJson, withAuth } from "@/lib/server/http";
import type { EvalSet } from "@/lib/types";

export async function GET(request: Request, context: RouteContext<"/api/eval-sets/[id]">) {
  return withAuth(request, async () => {
    const { id } = await context.params;
    const evalSet = await getEvalSet(id);
    if (!evalSet) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(evalSet);
  });
}

export async function PUT(request: Request, context: RouteContext<"/api/eval-sets/[id]">) {
  return withAuth(request, async () => {
    const { id } = await context.params;
    const body = await readJson<Partial<EvalSet>>(request);
    return Response.json(await saveEvalSet({ ...body, id }));
  });
}

export async function DELETE(request: Request, context: RouteContext<"/api/eval-sets/[id]">) {
  return withAuth(request, async () => {
    const { id } = await context.params;
    await deleteEvalSet(id);
    return Response.json({ ok: true });
  });
}
