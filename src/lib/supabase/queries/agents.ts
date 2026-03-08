// ============================================================
// Agent Queries
// ============================================================

import { createReadOnlyClient } from "../server";
import { dbAgentToAgent } from "../mappers";
import type { DbAgent } from "../mappers";
import type { Agent } from "@/lib/types";

export async function fetchAgents(): Promise<Agent[]> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("leaderboard_rank", { ascending: true });

  if (error) {
    console.error("fetchAgents error:", error.message, error.code, error.details);
    return [];
  }
  return (data as DbAgent[]).map(dbAgentToAgent);
}

export async function fetchAgent(id: string): Promise<Agent | null> {
  const supabase = createReadOnlyClient();
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return dbAgentToAgent(data as DbAgent);
}
