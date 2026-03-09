"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbAgentToAgent } from "@/lib/supabase/mappers";
import type { DbAgent } from "@/lib/supabase/mappers";
import type { Agent } from "@/lib/types";

export function useAgents(): { agents: Agent[]; loading: boolean } {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("agents")
      .select("*")
      .eq("is_active", true)
      .eq("is_paused", false)
      .order("leaderboard_rank", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setAgents((data as DbAgent[]).map(dbAgentToAgent));
        }
        setLoading(false);
      });
  }, []);

  return { agents, loading };
}
