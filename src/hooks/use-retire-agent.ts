"use client";

import { useCallback } from "react";
import { useMutation } from "@/hooks/use-mutation";

interface RetireAgentInput {
  agentId: string;
  walletAddress: string;
}

export function useRetireAgent() {
  const mutationFn = useCallback(
    async (input: RetireAgentInput) => {
      return fetch(
        `/api/user-agents/${input.agentId}?wallet_address=${encodeURIComponent(input.walletAddress)}`,
        { method: "DELETE" }
      );
    },
    []
  );

  const extractResult = useCallback(async () => {
    return true as const;
  }, []);

  const { mutate, loading, error } = useMutation<RetireAgentInput, true>(mutationFn, {
    extractResult,
    defaultErrorMessage: "Failed to retire agent",
  });

  const retire = useCallback(
    async (agentId: string, walletAddress: string): Promise<boolean> => {
      const result = await mutate({ agentId, walletAddress });
      return result !== null;
    },
    [mutate]
  );

  return { retire, loading, error };
}
