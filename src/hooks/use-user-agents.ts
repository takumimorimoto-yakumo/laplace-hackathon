"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  AgentTemplate,
  AgentSubscriptionInfo,
  InvestmentOutlook,
  LLMModel,
} from "@/lib/types";
import { signAction } from "@/lib/solana/sign-action";

interface MutationState<T> {
  mutate: (data: T) => Promise<string | null>;
  loading: boolean;
  error: string | null;
}

interface AdoptAgentData {
  walletAddress: string;
  name: string;
  template: AgentTemplate;
  llm: LLMModel;
  outlook: InvestmentOutlook;
  directives?: string;
  watchlist?: string[];
  alpha?: string;
  txSignature?: string;
  paymentToken?: "USDC" | "SKR" | "SOL";
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

interface UpdateAgentData {
  directives?: string;
  watchlist?: string[];
  alpha?: string;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  walletAddress: string;
}

interface PauseAgentData {
  isPaused: boolean;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  walletAddress: string;
}

export function useAdoptAgent(): MutationState<AdoptAgentData> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (data: AdoptAgentData): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      const { message, signature } = await signAction("new", "create", data.signMessage);
      const res = await fetch("/api/user-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          template: data.template,
          wallet_address: data.walletAddress,
          llm_model: data.llm,
          outlook: data.outlook,
          directives: data.directives,
          watchlist: data.watchlist,
          alpha: data.alpha,
          tx_signature: data.txSignature,
          payment_token: data.paymentToken,
          message,
          signature,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        const msg = (body as { error?: string }).error ?? "Failed to create agent";
        setError(msg);
        return null;
      }
      const result = await res.json() as { id: string };
      return result.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error };
}

export function useUpdateUserAgent(id: string): MutationState<UpdateAgentData> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (data: UpdateAgentData): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      const { message, signature } = await signAction(id, "update", data.signMessage);
      const res = await fetch(`/api/user-agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directives: data.directives,
          watchlist: data.watchlist,
          alpha: data.alpha,
          wallet_address: data.walletAddress,
          message,
          signature,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        const msg = (body as { error?: string }).error ?? "Failed to update agent";
        setError(msg);
        return null;
      }
      return id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  return { mutate, loading, error };
}

export function usePauseUserAgent(id: string): MutationState<PauseAgentData> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (data: PauseAgentData): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      const { message, signature } = await signAction(id, "pause", data.signMessage);
      const res = await fetch(`/api/user-agents/${id}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPaused: data.isPaused,
          wallet_address: data.walletAddress,
          message,
          signature,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        const msg = (body as { error?: string }).error ?? "Failed to toggle pause";
        setError(msg);
        return null;
      }
      return id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  return { mutate, loading, error };
}

// ---------- Subscription Hooks ----------

interface SubscriptionStatusResult {
  agents: AgentSubscriptionInfo[];
  loading: boolean;
  error: string | null;
  agentCount: number;
  refetch: () => void;
}

export function useSubscriptionStatus(
  wallet: string | null
): SubscriptionStatusResult {
  const [agents, setAgents] = useState<AgentSubscriptionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/user-agents/subscription-status?wallet=${encodeURIComponent(wallet)}`
      );
      if (!res.ok) {
        setError("Failed to fetch subscription status");
        return;
      }
      const data = (await res.json()) as { agents: AgentSubscriptionInfo[] };
      setAgents(data.agents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    agents,
    loading,
    error,
    agentCount: agents.length,
    refetch: fetchStatus,
  };
}

interface SubscribeAgentData {
  agentId: string;
  walletAddress: string;
  paymentToken: "USDC" | "SKR";
  txSignature?: string;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

export function useSubscribeAgent(): MutationState<SubscribeAgentData> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (data: SubscribeAgentData): Promise<string | null> => {
      setLoading(true);
      setError(null);
      try {
        const { message, signature } = await signAction(data.agentId, "subscribe", data.signMessage);
        const res = await fetch("/api/user-agents/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: data.agentId,
            walletAddress: data.walletAddress,
            paymentToken: data.paymentToken,
            txSignature: data.txSignature,
            message,
            signature,
          }),
        });
        if (!res.ok) {
          const body = await res
            .json()
            .catch(() => ({ error: "Unknown error" }));
          const msg =
            (body as { error?: string }).error ?? "Failed to subscribe";
          setError(msg);
          return null;
        }
        return data.agentId;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error";
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { mutate, loading, error };
}
