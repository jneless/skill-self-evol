import { requireAuth, unauthorized } from "./auth";

export async function withAuth(
  request: Request,
  handler: () => Promise<Response>,
) {
  if (!(await requireAuth(request))) return unauthorized();
  try {
    return await handler();
  } catch (error) {
    return jsonError(error);
  }
}

export function jsonError(error: unknown, status = 400) {
  return Response.json(
    { error: error instanceof Error ? error.message : "Unknown error" },
    { status },
  );
}

export async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}
