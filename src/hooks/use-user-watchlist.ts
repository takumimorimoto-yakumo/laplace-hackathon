"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MarketToken } from "@/lib/types";

export interface WatchlistToken {
  tokenAddress: string;
  tokenSymbol: string;
}

export function useUserWatchlist(walletAddress: string | null) {
  const [tokens, setTokens] = useState<WatchlistToken[]>([]);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!walletAddress) return;

    let cancelled = false;

    supabase
      .from("user_watchlist")
      .select("token_address, token_symbol")
      .eq("user_wallet", walletAddress)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to fetch watchlist:", error.message);
        } else {
          setTokens(
            (data ?? []).map((row) => ({
              tokenAddress: row.token_address as string,
              tokenSymbol: row.token_symbol as string,
            }))
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [walletAddress, supabase]);

  const addToken = useCallback(
    async (token: MarketToken) => {
      if (!walletAddress) return;
      const { error } = await supabase.from("user_watchlist").upsert(
        {
          user_wallet: walletAddress,
          token_address: token.address,
          token_symbol: token.symbol,
        },
        { onConflict: "user_wallet,token_address" }
      );
      if (!error) {
        setTokens((prev) => [
          { tokenAddress: token.address, tokenSymbol: token.symbol },
          ...prev.filter((t) => t.tokenAddress !== token.address),
        ]);
      }
    },
    [walletAddress, supabase]
  );

  const removeToken = useCallback(
    async (tokenAddress: string) => {
      if (!walletAddress) return;
      const { error } = await supabase
        .from("user_watchlist")
        .delete()
        .eq("user_wallet", walletAddress)
        .eq("token_address", tokenAddress);
      if (!error) {
        setTokens((prev) => prev.filter((t) => t.tokenAddress !== tokenAddress));
      }
    },
    [walletAddress, supabase]
  );

  return { tokens, addToken, removeToken };
}
