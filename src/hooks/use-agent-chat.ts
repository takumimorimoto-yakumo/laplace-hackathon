"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function useAgentChat(
  agentId: string,
  walletAddress: string | null
): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  // Fetch existing chat on mount
  useEffect(() => {
    if (!agentId || !walletAddress || fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchChat = async () => {
      try {
        const params = new URLSearchParams({
          agentId,
          wallet: walletAddress,
        });
        const res = await fetch(`/api/chat/send?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as { messages: ChatMessage[] };
        setMessages(data.messages);
      } catch {
        // Silently fail on initial fetch — user can still send messages
      }
    };

    void fetchChat();
  }, [agentId, walletAddress]);

  // Reset fetched ref when agentId or wallet changes
  useEffect(() => {
    fetchedRef.current = false;
    setMessages([]);
    setError(null);
  }, [agentId, walletAddress]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!walletAddress || !text.trim()) return;

      setError(null);

      // Optimistic UI: add user message immediately
      const optimisticMsg: ChatMessage = {
        role: "user",
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      setLoading(true);

      try {
        const res = await fetch("/api/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId,
            userWallet: walletAddress,
            message: text.trim(),
          }),
        });

        if (!res.ok) {
          const errData = (await res.json()) as { error: string };
          throw new Error(errData.error || "Failed to send message");
        }

        const data = (await res.json()) as { message: ChatMessage };
        setMessages((prev) => [...prev, data.message]);
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : "Failed to send message";
        setError(errMsg);
        // Remove the optimistic user message on error
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setLoading(false);
      }
    },
    [agentId, walletAddress]
  );

  return { messages, sendMessage, loading, error };
}
