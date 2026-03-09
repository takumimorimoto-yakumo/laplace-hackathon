"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface RegisteredAgent {
  id: string;
  name: string;
  style: string;
  reasoningStyle: string | null;
  timeHorizon: string | null;
  accuracyScore: number | null;
  leaderboardRank: number | null;
  tier: string;
  template: string | null;
  isPaused: boolean;
  isActive: boolean;
  isSystem: boolean;
  portfolioValue: number;
  portfolioReturn: number;
  totalPredictions: number;
  rentalPriceUsdc: number;
  liveTradingEnabled: boolean;
  walletEncryptedKey: boolean;
  userDirectives: string | null;
}

const EMPTY: RegisteredAgent[] = [];

export function useUserRegisteredAgents(walletAddress: string | null, isAdmin = false) {
  const [agents, setAgents] = useState<RegisteredAgent[]>(EMPTY);
  const [fetched, setFetched] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!walletAddress) return;

    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!base58Regex.test(walletAddress)) return;

    let cancelled = false;

    const selectCols = "id, name, style, reasoning_style, time_horizon, accuracy_score, leaderboard_rank, tier, template, is_paused, is_active, is_system, portfolio_value, portfolio_return, total_predictions, rental_price_usdc, live_trading_enabled, wallet_address, user_directives";

    const mapRow = (row: Record<string, unknown>): RegisteredAgent => ({
      id: row.id as string,
      name: row.name as string,
      style: row.style as string,
      reasoningStyle: (row.reasoning_style as string | null) ?? null,
      timeHorizon: (row.time_horizon as string | null) ?? null,
      accuracyScore: row.accuracy_score as number | null,
      leaderboardRank: row.leaderboard_rank as number | null,
      tier: (row.tier as string) ?? "external",
      template: (row.template as string | null) ?? null,
      isPaused: (row.is_paused as boolean) ?? false,
      isActive: (row.is_active as boolean) ?? true,
      isSystem: (row.is_system as boolean) ?? false,
      portfolioValue: (row.portfolio_value as number) ?? 0,
      portfolioReturn: (row.portfolio_return as number) ?? 0,
      totalPredictions: (row.total_predictions as number) ?? 0,
      rentalPriceUsdc: (row.rental_price_usdc as number) ?? 0,
      liveTradingEnabled: (row.live_trading_enabled as boolean) ?? false,
      walletEncryptedKey: !!(row.wallet_address),
      userDirectives: (row.user_directives as string | null) ?? null,
    });

    // Fetch user's own agents
    const userPromise = supabase
      .from("agents")
      .select(selectCols)
      .or(`owner_wallet.eq.${walletAddress},wallet_address.eq.${walletAddress}`)
      .order("created_at", { ascending: false });

    // Admin: also fetch system agents
    const systemPromise = isAdmin
      ? supabase
          .from("agents")
          .select(selectCols)
          .eq("is_system", true)
          .order("created_at", { ascending: false })
      : null;

    Promise.all([userPromise, systemPromise]).then(([userResult, systemResult]) => {
      if (cancelled) return;
      if (userResult.error) {
        console.error("Failed to fetch registered agents:", userResult.error.message);
      }

      const userAgents = (userResult.data ?? []).map(mapRow);
      const systemAgents = (systemResult?.data ?? []).map(mapRow);

      // Merge, dedup by id (user agents take priority)
      const seen = new Set(userAgents.map((a) => a.id));
      const merged = [...userAgents, ...systemAgents.filter((a) => !seen.has(a.id))];
      setAgents(merged);
      setFetched(true);
    });

    return () => {
      cancelled = true;
    };
  }, [walletAddress, supabase, isAdmin]);

  const loading = !!walletAddress && !fetched;

  const updateAgent = (agentId: string, patch: Partial<RegisteredAgent>) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, ...patch } : a))
    );
  };

  return { agents, loading, updateAgent };
}
