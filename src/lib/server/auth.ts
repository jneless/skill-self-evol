import { jwtVerify, SignJWT } from "jose";
import { getEnv } from "./env";

const encoder = new TextEncoder();

export async function verifyWorkspacePassword(password: string) {
  return password === getEnv().WORKSPACE_PASSWORD;
}

export async function createWorkspaceToken() {
  const env = getEnv();
  const secret = encoder.encode(env.WORKSPACE_TOKEN_SECRET);
  return new SignJWT({ scope: "workspace" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${env.WORKSPACE_TOKEN_TTL_HOURS}h`)
    .sign(secret);
}

export async function verifyWorkspaceToken(token: string) {
  const env = getEnv();
  const secret = encoder.encode(env.WORKSPACE_TOKEN_SECRET);
  const result = await jwtVerify(token, secret);
  return result.payload.scope === "workspace";
}

export async function requireAuth(request: Request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return false;
  }

  try {
    return await verifyWorkspaceToken(token);
  } catch {
    return false;
  }
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
