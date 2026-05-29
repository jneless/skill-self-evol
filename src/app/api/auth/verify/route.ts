import { createWorkspaceToken, verifyWorkspacePassword } from "@/lib/server/auth";
import { jsonError } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: string };
    if (!(await verifyWorkspacePassword(body.password || ""))) {
      return Response.json({ error: "密码不正确" }, { status: 401 });
    }
    return Response.json({ token: await createWorkspaceToken() });
  } catch (error) {
    return jsonError(error);
  }
}
