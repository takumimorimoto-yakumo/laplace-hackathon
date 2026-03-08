"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  FileEdit,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Zap,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { getAgentAvatarUrl } from "@/lib/avatar";
import { formatRelativeDate } from "@/lib/format";
import { explorerTxUrl } from "@/lib/solana/explorer";
import type { RegisteredAgent } from "@/hooks/use-user-registered-agents";
import type { AgentBreakdown, OwnerPosition, OwnerTrade } from "@/lib/types";

interface AgentCommandCardProps {
  agent: RegisteredAgent;
  breakdown?: AgentBreakdown;
  positions: OwnerPosition[];
  trades: OwnerTrade[];
  walletAddress: string;
  onAgentUpdated: () => void;
}

function TradeBadge({ isLive }: { isLive: boolean }) {
  const t = useTranslations("me");
  if (isLive) {
    return (
      <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        {t("liveBadge")}
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
      {t("simBadge")}
    </span>
  );
}

export function AgentCommandCard({
  agent,
  breakdown,
  positions,
  trades,
  walletAddress,
  onAgentUpdated,
}: AgentCommandCardProps) {
  const t = useTranslations("me");
  const [expanded, setExpanded] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [directivesOpen, setDirectivesOpen] = useState(false);
  const [directives, setDirectives] = useState(agent.userDirectives ?? "");
  const [directivesSaving, setDirectivesSaving] = useState(false);

  const returnPct = (agent.portfolioReturn * 100).toFixed(1);
  const isPositiveReturn = agent.portfolioReturn >= 0;

  async function handlePauseToggle() {
    setPauseLoading(true);
    try {
      const res = await fetch(`/api/user-agents/${agent.id}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: walletAddress }),
      });
      if (res.ok) {
        onAgentUpdated();
      }
    } finally {
      setPauseLoading(false);
    }
  }

  async function handleDirectivesSave() {
    setDirectivesSaving(true);
    try {
      const res = await fetch(`/api/user-agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: walletAddress,
          directives,
        }),
      });
      if (res.ok) {
        setDirectivesOpen(false);
        onAgentUpdated();
      }
    } finally {
      setDirectivesSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border mb-3">
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors"
      >
        <Avatar size="sm">
          <AvatarImage src={getAgentAvatarUrl(agent.name)} alt={agent.name} />
          <AvatarFallback>
            <Bot className="size-4" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground truncate">
              {agent.name}
            </span>
            <TradeBadge isLive={breakdown?.isLive ?? false} />
            {agent.isPaused ? (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
                <Pause className="size-2.5" />
                {t("statusPaused")}
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-[10px] text-bullish">
                <span className="size-1.5 rounded-full bg-bullish" />
                {t("statusActive")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs font-mono text-muted-foreground">
              ${agent.portfolioValue.toLocaleString()}
            </span>
            <span
              className={`text-xs font-mono font-medium flex items-center gap-0.5 ${
                isPositiveReturn ? "text-bullish" : "text-bearish"
              }`}
            >
              {isPositiveReturn ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {isPositiveReturn ? "+" : ""}
              {returnPct}%
            </span>
            {positions.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {positions.length} {t("positions")}
              </span>
            )}
            {breakdown && breakdown.earnings > 0 && (
              <span className="text-[10px] text-muted-foreground">
                ${breakdown.earnings.toFixed(2)}
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-3 pb-3">
          {/* Action buttons */}
          <div className="flex items-center gap-2 py-3">
            {agent.tier === "user" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                disabled={pauseLoading}
                onClick={handlePauseToggle}
              >
                {agent.isPaused ? (
                  <>
                    <Play className="size-3" />
                    {t("resumeAgent")}
                  </>
                ) : (
                  <>
                    <Pause className="size-3" />
                    {t("pauseAgent")}
                  </>
                )}
              </Button>
            )}
            {agent.tier === "user" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  setDirectives(agent.userDirectives ?? "");
                  setDirectivesOpen(true);
                }}
              >
                <FileEdit className="size-3" />
                {t("editDirectives")}
              </Button>
            )}
            <Link href={`/agent/${agent.id}`}>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                <ExternalLink className="size-3" />
                {t("viewProfile")}
              </Button>
            </Link>
          </div>

          {/* Positions */}
          {positions.length > 0 ? (
            <div className="mb-3">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">
                {t("positions")}
              </h4>
              <div className="space-y-1.5">
                {positions.map((pos, i) => {
                  const isPositive = pos.currentReturn >= 0;
                  return (
                    <div
                      key={`${pos.agentId}-${pos.tokenSymbol}-${i}`}
                      className="flex items-center justify-between py-1"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {pos.direction === "long" ? (
                          <ArrowUpRight className="size-3.5 text-bullish shrink-0" />
                        ) : (
                          <ArrowDownRight className="size-3.5 text-bearish shrink-0" />
                        )}
                        <span className="text-sm text-foreground truncate">
                          {pos.tokenSymbol}
                        </span>
                        <TradeBadge isLive={pos.isLive} />
                        {pos.isLive && pos.txSignature && (
                          <a
                            href={explorerTxUrl(pos.txSignature)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:text-emerald-300"
                          >
                            <Zap className="size-3" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] text-muted-foreground/60">
                          {formatRelativeDate(pos.enteredAt)}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          ${pos.size.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                        <span
                          className={`text-xs font-mono font-medium min-w-[52px] text-right ${
                            isPositive ? "text-bullish" : "text-bearish"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {(pos.currentReturn * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mb-3">
              {t("noPositions")}
            </p>
          )}

          {/* Recent Trades */}
          {trades.length > 0 ? (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">
                {t("trades")}
              </h4>
              <div className="space-y-1.5">
                {trades.map((trade, i) => {
                  const isBuy = trade.action === "buy";
                  const hasPnl = trade.pnl !== null && trade.pnl !== 0;
                  return (
                    <div
                      key={`${trade.agentId}-${trade.executedAt}-${i}`}
                      className="flex items-center justify-between py-1"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                            isBuy
                              ? "bg-bullish/10 text-bullish"
                              : "bg-bearish/10 text-bearish"
                          }`}
                        >
                          {trade.action}
                        </span>
                        <span className="text-sm text-foreground truncate">
                          {trade.tokenSymbol}
                        </span>
                        <TradeBadge isLive={trade.isLive} />
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] text-muted-foreground/60">
                          {formatRelativeDate(trade.executedAt)}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          ${trade.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                        {hasPnl && (
                          <span
                            className={`text-xs font-mono font-medium ${
                              trade.pnl! >= 0 ? "text-bullish" : "text-bearish"
                            }`}
                          >
                            {trade.pnl! >= 0 ? "+" : ""}${trade.pnl!.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("noTrades")}</p>
          )}
        </div>
      )}

      {/* Edit Directives Sheet */}
      <Sheet open={directivesOpen} onOpenChange={setDirectivesOpen}>
        <SheetContent side="bottom" className="max-h-[70vh]">
          <SheetHeader>
            <SheetTitle>{t("editDirectives")}</SheetTitle>
            <SheetDescription>{agent.name}</SheetDescription>
          </SheetHeader>
          <div className="px-4 py-3">
            <textarea
              value={directives}
              onChange={(e) => setDirectives(e.target.value)}
              maxLength={500}
              rows={5}
              className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder={t("editDirectives")}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-muted-foreground">
                {directives.length}/500
              </span>
              <Button
                size="sm"
                disabled={directivesSaving}
                onClick={handleDirectivesSave}
              >
                {directivesSaving ? "..." : t("saveDirectives")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
