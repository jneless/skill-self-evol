import { getEvolutionExperiment } from "@/lib/server/evolution";
import { withAuth } from "@/lib/server/http";

export async function GET(
  request: Request,
  context: RouteContext<"/api/evolution-experiments/[id]/candidates/[candidateId]/download">,
) {
  return withAuth(request, async () => {
    const { id, candidateId } = await context.params;
    const experiment = await getEvolutionExperiment(id);
    const candidate = experiment?.candidates.find((item) => item.id === candidateId);
    if (!candidate) return Response.json({ error: "Not found" }, { status: 404 });
    return new Response(candidate.content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="SKILL.md"',
      },
    });
  });
}
