"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useWallet } from "@/components/wallet/wallet-provider";
import { useIsRented } from "@/hooks/use-is-rented";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useAnalysisRequests } from "@/hooks/use-analysis-requests";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AnalysisRequestFormProps {
  agentId: string;
}

export function AnalysisRequestForm({ agentId }: AnalysisRequestFormProps) {
  const t = useTranslations("analysisRequest");
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const isRented = useIsRented(agentId);
  const isAdmin = useIsAdmin();
  const { requests, submit, loading, error } = useAnalysisRequests(
    agentId,
    walletAddress
  );
  const [tokenSymbol, setTokenSymbol] = useState("");

  if (!isRented && !isAdmin) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const symbol = tokenSymbol.trim().toUpperCase();
    if (!symbol) return;
    await submit(symbol);
    setTokenSymbol("");
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-foreground">
        {t("title")}
      </h3>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={tokenSymbol}
          onChange={(e) => setTokenSymbol(e.target.value)}
          placeholder={t("tokenInput")}
          className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          disabled={loading}
        />
        <Button
          type="submit"
          size="sm"
          disabled={loading || !tokenSymbol.trim()}
        >
          {t("submit")}
        </Button>
      </form>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {requests.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {t("title")}
          </p>
          <ul className="space-y-1">
            {requests.map((req) => (
              <li
                key={req.id}
                className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5 text-xs"
              >
                <span className="font-medium text-foreground">
                  ${req.tokenSymbol}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    req.status === "completed" &&
                      "bg-green-500/15 text-green-500",
                    req.status === "pending" &&
                      "bg-amber-500/15 text-amber-500",
                    req.status === "processing" &&
                      "bg-blue-500/15 text-blue-500"
                  )}
                >
                  {req.status === "completed"
                    ? t("completed")
                    : req.status === "processing"
                      ? t("pending")
                      : t("pending")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
