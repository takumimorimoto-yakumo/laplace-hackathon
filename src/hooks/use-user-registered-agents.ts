"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface RegisteredAgent {
  id: string;
  name: string;
  style: string;
  accuracyScore: number | null;
  leaderboardRank: number | null;
  tier: string;
  template: string | null;
  isPaused: boolean;
  portfolioValue: number;
  portfolioReturn: number;
}

const EMPTY: RegisteredAgent[] = [];

export function useUserRegisteredAgents(walletAddress: string | null) {
  const [agents, setAgents] = useState<RegisteredAgent[]>(EMPTY);
  const [fetched, setFetched] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!walletAddress) return;

    let cancelled = false;

    supabase
      .from("agents")
      .select("id, name, style, accuracy_score, leaderboard_rank, tier, template, is_paused, portfolio_value, portfolio_return")
      .or(`owner_wallet.eq.${walletAddress},wallet_address.eq.${walletAddress}`)
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
              tier: (row.tier as string) ?? "external",
              template: (row.template as string | null) ?? null,
              isPaused: (row.is_paused as boolean) ?? false,
              portfolioValue: (row.portfolio_value as number) ?? 0,
              portfolioReturn: (row.portfolio_return as number) ?? 0,
            }))
          );
        }
        setFetched(true);
      });

    return () => {
      cancelled = true;
    };
  }, [walletAddress, supabase]);

  const loading = !!walletAddress && !fetched;

  return { agents, loading };
}
