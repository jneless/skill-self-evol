import { getCurrentSkill, saveCurrentSkill } from "@/lib/server/workspace";
import { readJson, withAuth } from "@/lib/server/http";

export async function GET(request: Request) {
  return withAuth(request, async () => Response.json(await getCurrentSkill()));
}

export async function PUT(request: Request) {
  return withAuth(request, async () => {
    const body = await readJson<{ content: string }>(request);
    return Response.json(await saveCurrentSkill(body.content || "","paste"));
  });
}
