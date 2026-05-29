import { withAuth } from "@/lib/server/http";
import { getCurrentTask } from "@/lib/server/tasks";

export async function GET(request: Request) {
  return withAuth(request, async () => Response.json(await getCurrentTask()));
}
