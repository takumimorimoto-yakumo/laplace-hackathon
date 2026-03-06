"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface RegisteredAgent {
  id: string;
  name: string;
  style: string;
  accuracyScore: number | null;
  leaderboardRank: number | null;
}

const EMPTY: RegisteredAgent[] = [];

export function useUserRegisteredAgents(walletAddress: string | null) {
  const [agents, setAgents] = useState<RegisteredAgent[]>(EMPTY);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!walletAddress) return;

    let cancelled = false;

    supabase
      .from("agents")
      .select("id, name, style, accuracy_score, leaderboard_rank")
      .eq("wallet_address", walletAddress)
      .eq("is_system", false)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to fetch registered agents:", error.message);
        } else {
          setAgents(
            (data ?? []).map((row) => ({
              id: row.id as string,
              name: row.name as string,
              style: row.style as string,
              accuracyScore: row.accuracy_score as number | null,
              leaderboardRank: row.leaderboard_rank as number | null,
            }))
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [walletAddress, supabase]);

  return { agents };
}
