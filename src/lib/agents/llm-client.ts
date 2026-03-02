// ============================================================
// LLM Client — Multi-LLM routing via OpenAI-compatible + Anthropic
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

import type { LLMModel } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Agent's llm_model field — determines which provider to use */
  llmModel?: LLMModel;
}

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

interface OpenAICompatConfig {
  provider: "openai-compat";
  modelId: string;
  baseURL: string;
  envKey: string;
}

interface AnthropicConfig {
  provider: "anthropic";
  modelId: string;
  envKey: string;
}

type ProviderConfig = OpenAICompatConfig | AnthropicConfig;

const PROVIDER_MAP: Record<LLMModel, ProviderConfig> = {
  "gemini-pro": {
    provider: "openai-compat",
    modelId: "gemini-2.5-flash",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    envKey: "GOOGLE_API_KEY",
  },
  "gpt-4o": {
    provider: "openai-compat",
    modelId: "gpt-4o",
    baseURL: "https://api.openai.com/v1",
    envKey: "OPENAI_API_KEY",
  },
  "gpt-4o-mini": {
    provider: "openai-compat",
    modelId: "gpt-4o-mini",
    baseURL: "https://api.openai.com/v1",
    envKey: "OPENAI_API_KEY",
  },
  deepseek: {
    provider: "openai-compat",
    modelId: "deepseek-chat",
    baseURL: "https://api.deepseek.com/v1",
    envKey: "DEEPSEEK_API_KEY",
  },
  qwen: {
    provider: "openai-compat",
    modelId: "qwen-plus",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    envKey: "QWEN_API_KEY",
  },
  minimax: {
    provider: "openai-compat",
    modelId: "MiniMax-Text-01",
    baseURL: "https://api.minimax.chat/v1",
    envKey: "MINIMAX_API_KEY",
  },
  grok: {
    provider: "openai-compat",
    modelId: "grok-2",
    baseURL: "https://api.x.ai/v1",
    envKey: "XAI_API_KEY",
  },
  "claude-sonnet": {
    provider: "anthropic",
    modelId: "claude-sonnet-4-5-20250929",
    envKey: "ANTHROPIC_API_KEY",
  },
};

const DEFAULT_LLM_MODEL: LLMModel = "gemini-pro";

// ---------------------------------------------------------------------------
// Client caching
// ---------------------------------------------------------------------------

/** Cache OpenAI-compatible clients by base URL to avoid creating duplicates */
const openaiClientCache = new Map<string, OpenAI>();

/** Single cached Anthropic client instance */
let anthropicClient: Anthropic | null = null;

function getOpenAIClient(baseURL: string, envKey: string): OpenAI {
  const cached = openaiClientCache.get(baseURL);
  if (cached) return cached;

  const apiKey = process.env[envKey];
  if (!apiKey) {
    throw new Error(`${envKey} is not set`);
  }

  const client = new OpenAI({ apiKey, baseURL });
  openaiClientCache.set(baseURL, client);
  return client;
}

function getAnthropicClient(envKey: string): Anthropic {
  if (anthropicClient) return anthropicClient;

  const apiKey = process.env[envKey];
  if (!apiKey) {
    throw new Error(`${envKey} is not set`);
  }

  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

// ---------------------------------------------------------------------------
// Provider resolver
// ---------------------------------------------------------------------------

export function getProvider(llmModel: string): ProviderConfig {
  const config = PROVIDER_MAP[llmModel as LLMModel];
  if (!config) {
    throw new Error(`Unsupported LLM model: ${llmModel}`);
  }
  return config;
}

// ---------------------------------------------------------------------------
// Chat completion
// ---------------------------------------------------------------------------

export async function chatCompletion(
  messages: ChatMessage[],
  options?: LLMOptions
): Promise<string> {
  const llmModel = options?.llmModel ?? DEFAULT_LLM_MODEL;
  const config = getProvider(llmModel);

  if (config.provider === "anthropic") {
    return chatCompletionAnthropic(messages, config, options);
  }

  return chatCompletionOpenAI(messages, config, options);
}

// ---------------------------------------------------------------------------
// OpenAI-compatible completion
// ---------------------------------------------------------------------------

async function chatCompletionOpenAI(
  messages: ChatMessage[],
  config: OpenAICompatConfig,
  options?: LLMOptions
): Promise<string> {
  const client = getOpenAIClient(config.baseURL, config.envKey);

  const response = await client.chat.completions.create({
    model: options?.model ?? config.modelId,
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

// ---------------------------------------------------------------------------
// Anthropic completion
// ---------------------------------------------------------------------------

async function chatCompletionAnthropic(
  messages: ChatMessage[],
  config: AnthropicConfig,
  options?: LLMOptions
): Promise<string> {
  const client = getAnthropicClient(config.envKey);

  // Extract system message (if present) into the top-level `system` param
  let systemPrompt: string | undefined;
  const anthropicMessages: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemPrompt = msg.content;
    } else {
      anthropicMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  const response = await client.messages.create({
    model: options?.model ?? config.modelId,
    max_tokens: options?.maxTokens ?? 1024,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: anthropicMessages,
    ...(options?.temperature !== undefined
      ? { temperature: options.temperature }
      : {}),
  });

  const block = response.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Anthropic returned empty response");
  }

  return block.text;
}
