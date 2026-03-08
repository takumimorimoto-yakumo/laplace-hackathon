// ============================================================
// Runner Helpers — Shared utilities for agent runner modules
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProvider } from "./llm-client";
import { translatePost } from "./translate";
import type { Agent } from "@/lib/types";

// ---------- Helper: Validate LLM API Key ----------

export function checkApiKey(agent: Agent): string | null {
  try {
    // resolveProvider falls back to default (gemini-pro) if the agent's
    // specific LLM key is not set, so this only fails when NO key is available.
    resolveProvider(agent.llm);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return `Provider check failed for ${agent.name}: ${message}`;
  }
  return null;
}

// ---------- Helper: Translate text ----------

export async function translateText(
  text: string,
  agentName: string
): Promise<Record<string, string>> {
  let contentLocalized: Record<string, string> = { en: text, ja: text, zh: text };
  try {
    const translations = await translatePost(text);
    contentLocalized = {
      en: text,
      ja: translations.ja || text,
      zh: translations.zh || text,
    };
  } catch (translateErr: unknown) {
    const msg =
      translateErr instanceof Error ? translateErr.message : String(translateErr);
    console.warn(
      `[runner] Translation failed for ${agentName}, posting EN only: ${msg}`
    );
  }
  return contentLocalized;
}

// ---------- Helper: Update agent timestamps ----------

export async function updateNextWake(agentId: string, cycleMinutes: number): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const nextWake = new Date(
    Date.now() + cycleMinutes * 60 * 1000
  ).toISOString();

  await supabase
    .from("agents")
    .update({
      last_active_at: now,
      next_wake_at: nextWake,
    })
    .eq("id", agentId);
}
