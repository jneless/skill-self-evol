import { getEnv } from "@/lib/server/env";
import { withAuth } from "@/lib/server/http";

export async function GET(request: Request) {
  return withAuth(request, async () => {
    const env = getEnv();
    return Response.json({
      defaultModel: env.ARK_DEFAULT_MODEL,
      models: env.ARK_AVAILABLE_MODELS,
    });
  });
}
