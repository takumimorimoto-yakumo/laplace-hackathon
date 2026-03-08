"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  AgentTemplate,
  AgentSubscriptionInfo,
  InvestmentOutlook,
  LLMModel,
} from "@/lib/types";
import { signAction } from "@/lib/solana/sign-action";
import { useMutation } from "@/hooks/use-mutation";

interface MutationState<T> {
  mutate: (data: T) => Promise<string | null>;
  loading: boolean;
  error: string | null;
}

// ---------- Internal Helper: Signed Mutation ----------

/**
 * Helper function to build a signed mutation.
 * Eliminates duplication of signAction + fetch pattern across multiple hooks.
 */
function buildSignedMutation<TInput extends { signMessage: (message: Uint8Array) => Promise<Uint8Array> }>(
  agentId: string,
  action: string,
  buildRequest: (input: TInput, signedData: { message: string; signature: string }) => Promise<Response>
): (input: TInput) => Promise<Response> {
  return async (input: TInput) => {
    const { message, signature } = await signAction(agentId, action, input.signMessage);
    return buildRequest(input, { message, signature });
  };
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
  const mutationFn = useCallback(
    buildSignedMutation<AdoptAgentData>("new", "create", async (data, { message, signature }) =>
      fetch("/api/user-agents", {
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
      })
    ),
    []
  );

  const extractResult = useCallback(async (res: Response) => {
    const result = (await res.json()) as { id: string };
    return result.id;
  }, []);

  const { mutate, loading, error } = useMutation<AdoptAgentData, string>(mutationFn, {
    extractResult,
    defaultErrorMessage: "Failed to create agent",
  });

  return { mutate, loading, error };
}

export function useUpdateUserAgent(id: string): MutationState<UpdateAgentData> {
  const mutationFn = useCallback(
    buildSignedMutation<UpdateAgentData>(id, "update", async (data, { message, signature }) =>
      fetch(`/api/user-agents/${id}`, {
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
      })
    ),
    [id]
  );

  const { mutate, loading, error } = useMutation<UpdateAgentData, string>(mutationFn, {
    extractResult: useCallback(async () => id, [id]),
    defaultErrorMessage: "Failed to update agent",
  });

  return { mutate, loading, error };
}

export function usePauseUserAgent(id: string): MutationState<PauseAgentData> {
  const mutationFn = useCallback(async (data: PauseAgentData) => {
    const { message, signature } = await signAction(id, "pause", data.signMessage);
    return fetch(`/api/user-agents/${id}/pause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isPaused: data.isPaused,
        wallet_address: data.walletAddress,
        message,
        signature,
      }),
    });
  }, [id]);

  const { mutate, loading, error } = useMutation<PauseAgentData, string>(mutationFn, {
    extractResult: useCallback(async () => id, [id]),
    defaultErrorMessage: "Failed to toggle pause",
  });

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
  const mutationFn = useCallback(
    async (data: SubscribeAgentData) => {
      const { message, signature } = await signAction(data.agentId, "subscribe", data.signMessage);
      return fetch("/api/user-agents/subscribe", {
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
    },
    []
  );

  const { mutate, loading, error } = useMutation<SubscribeAgentData, string>(mutationFn, {
    extractResult: useCallback(
      async (_: Response, input: SubscribeAgentData) => input.agentId,
      []
    ),
    defaultErrorMessage: "Failed to subscribe",
  });

  return { mutate, loading, error };
}
