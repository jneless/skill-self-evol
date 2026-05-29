import { withAuth } from "@/lib/server/http";
import { getCurrentSkill } from "@/lib/server/workspace";

export async function GET(request: Request) {
  return withAuth(request, async () => {
    const skill = await getCurrentSkill();
    return new Response(skill.content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="SKILL.md"',
      },
    });
  });
}
