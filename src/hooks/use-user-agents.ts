"use client";

import { useState, useCallback } from "react";
import type { AgentTemplate, InvestmentOutlook, LLMModel } from "@/lib/types";

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
}

interface UpdateAgentData {
  directives?: string;
  watchlist?: string[];
  alpha?: string;
}

interface PauseAgentData {
  isPaused: boolean;
}

export function useAdoptAgent(): MutationState<AdoptAgentData> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (data: AdoptAgentData): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        const msg = (body as { error?: string }).error ?? "Failed to create agent";
        setError(msg);
        return null;
      }
      const result = await res.json() as { agentId: string };
      return result.agentId;
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
      const res = await fetch(`/api/user-agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
      const res = await fetch(`/api/user-agents/${id}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
