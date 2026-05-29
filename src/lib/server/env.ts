import { z } from "zod";

const envSchema = z.object({
  WORKSPACE_PASSWORD: z.string().min(1),
  WORKSPACE_TOKEN_SECRET: z.string().min(16),
  WORKSPACE_TOKEN_TTL_HOURS: z.coerce.number().positive().default(12),
  ARK_API_KEY: z.string().min(1),
  ARK_BASE_URL: z.string().url(),
  ARK_DEFAULT_MODEL: z.string().min(1),
  ARK_AVAILABLE_MODELS: z.string().min(1),
  ARK_REQUEST_TIMEOUT_MS: z.coerce.number().positive().default(120000),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  TASK_STALE_TIMEOUT_MINUTES: z.coerce.number().positive().default(30),
  MAX_SKILL_MD_BYTES: z.coerce.number().positive().default(204800),
  MAX_SOURCE_ZIP_BYTES: z.coerce.number().positive().default(2097152),
  MAX_EVAL_CASES_PER_RUN: z.coerce.number().positive().default(30),
  MAX_DIRECT_IMPROVE_ROUNDS: z.coerce.number().positive().default(5),
  MAX_DIVERSE_CANDIDATE_ROUNDS: z.coerce.number().positive().default(3),
  MAX_DIVERSE_CANDIDATES_PER_ROUND: z.coerce.number().positive().default(3),
});

export type AppEnv = ReturnType<typeof getEnv>;

export function getEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${messages}`);
  }

  return {
    ...parsed.data,
    ARK_AVAILABLE_MODELS: parsed.data.ARK_AVAILABLE_MODELS.split(",")
      .map((model) => model.trim())
      .filter(Boolean),
  };
}
