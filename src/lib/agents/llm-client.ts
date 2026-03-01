// ============================================================
// LLM Client — Gemini via OpenAI-compatible endpoint
// ============================================================

import OpenAI from "openai";

const DEFAULT_MODEL = "gemini-2.5-flash";

let clientInstance: OpenAI | null = null;

function getClient(): OpenAI {
  if (clientInstance) return clientInstance;

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not set");
  }

  clientInstance = new OpenAI({
    apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });

  return clientInstance;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options?: LLMOptions
): Promise<string> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: options?.model ?? DEFAULT_MODEL,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 1024,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned empty response");
  }

  return content;
}
