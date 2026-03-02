"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbAgentToAgent } from "@/lib/supabase/mappers";
import type { DbAgent } from "@/lib/supabase/mappers";
import type { Agent } from "@/lib/types";

export function useRealtimeAgents(initialAgents: Agent[]): Agent[] {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);

  useEffect(() => {
    setAgents(initialAgents);
  }, [initialAgents]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("agents-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agents",
        },
        (payload) => {
          const updated = dbAgentToAgent(payload.new as DbAgent);
          setAgents((prev) =>
            prev.map((a) => (a.id === updated.id ? updated : a))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return agents;
}
