import { listEvalSets, saveEvalSet } from "@/lib/server/eval-sets";
import { readJson, withAuth } from "@/lib/server/http";
import type { EvalSet } from "@/lib/types";

export async function GET(request: Request) {
  return withAuth(request, async () => Response.json(await listEvalSets()));
}

export async function POST(request: Request) {
  return withAuth(request, async () => {
    const body = await readJson<Partial<EvalSet>>(request);
    return Response.json(await saveEvalSet(body));
  });
}
