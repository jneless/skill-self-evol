import { beforeEach, describe, expect, it } from "vitest";
import {
  createWorkspaceToken,
  verifyWorkspacePassword,
  verifyWorkspaceToken,
} from "./auth";

describe("workspace auth", () => {
  beforeEach(() => {
    process.env.WORKSPACE_PASSWORD = "secret";
    process.env.WORKSPACE_TOKEN_SECRET =
      "test-secret-with-enough-length-for-hmac-signing";
    process.env.WORKSPACE_TOKEN_TTL_HOURS = "12";
    process.env.ARK_API_KEY = "x";
    process.env.ARK_BASE_URL = "https://example.com/api/v3";
    process.env.ARK_DEFAULT_MODEL = "model-a";
    process.env.ARK_AVAILABLE_MODELS = "model-a";
    process.env.S3_ENDPOINT = "https://s3.example.com";
    process.env.S3_REGION = "us-east-1";
    process.env.S3_BUCKET = "bucket";
    process.env.S3_ACCESS_KEY_ID = "key";
    process.env.S3_SECRET_ACCESS_KEY = "secret-key";
    process.env.S3_FORCE_PATH_STYLE = "false";
  });

  it("checks password and verifies issued tokens", async () => {
    expect(await verifyWorkspacePassword("bad")).toBe(false);
    expect(await verifyWorkspacePassword("secret")).toBe(true);

    const token = await createWorkspaceToken();
    await expect(verifyWorkspaceToken(token)).resolves.toBe(true);
  });
});
