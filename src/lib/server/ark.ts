import type { LlmUsage } from "../types";
import { getEnv } from "./env";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletion = {
  content: string;
  usage: LlmUsage;
};

export type LlmClient = {
  complete(messages: ChatMessage[], options?: { temperature?: number }): Promise<ChatCompletion>;
};

export function createArkClient(model: string): LlmClient {
  return {
    async complete(messages, options) {
      const env = getEnv();
      const startedAt = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), env.ARK_REQUEST_TIMEOUT_MS);
      let response: Response;

      try {
        response = await fetch(`${env.ARK_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.ARK_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: options?.temperature ?? 0.2,
          }),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(
            `Ark request timed out after ${env.ARK_REQUEST_TIMEOUT_MS}ms`,
          );
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ark request failed (${response.status}): ${text}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      return {
        content: data.choices?.[0]?.message?.content || "",
        usage: {
          model,
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
          calls: 1,
          durationMs: Date.now() - startedAt,
        },
      };
    },
  };
}

export function addUsage(a: LlmUsage, b: LlmUsage): LlmUsage {
  return {
    model: a.model || b.model,
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    calls: a.calls + b.calls,
    durationMs: a.durationMs + b.durationMs,
  };
}

export function extractJsonObject<T>(text: string, fallback: T): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] || text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return fallback;

  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return fallback;
  }
}
