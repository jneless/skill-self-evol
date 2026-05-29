import { beforeEach, describe, expect, it } from "vitest";
import { getEnv } from "./env";

describe("getEnv", () => {
  beforeEach(() => {
    process.env.WORKSPACE_PASSWORD = "password";
    process.env.WORKSPACE_TOKEN_SECRET =
      "test-secret-with-enough-length-for-hmac-signing";
    process.env.WORKSPACE_TOKEN_TTL_HOURS = "12";
    process.env.ARK_API_KEY = "ark-key";
    process.env.ARK_BASE_URL = "https://ark.example.com/api/v3";
    process.env.ARK_DEFAULT_MODEL = "deepseek-v4-pro";
    process.env.ARK_AVAILABLE_MODELS = "deepseek-v4-pro,seed-2.0-pro";
    delete process.env.ARK_REQUEST_TIMEOUT_MS;
    process.env.S3_ENDPOINT = "https://s3.example.com";
    process.env.S3_REGION = "cn-north-1";
    process.env.S3_BUCKET = "bucket";
    process.env.S3_ACCESS_KEY_ID = "access";
    process.env.S3_SECRET_ACCESS_KEY = "secret";
    process.env.S3_FORCE_PATH_STYLE = "false";
    process.env.TASK_STALE_TIMEOUT_MINUTES = "30";
  });

  it("parses model list and virtual-host S3 style", () => {
    const env = getEnv();

    expect(env.ARK_AVAILABLE_MODELS).toEqual([
      "deepseek-v4-pro",
      "seed-2.0-pro",
    ]);
    expect(env.S3_FORCE_PATH_STYLE).toBe(false);
    expect(env.ARK_REQUEST_TIMEOUT_MS).toBe(120000);
  });
});
