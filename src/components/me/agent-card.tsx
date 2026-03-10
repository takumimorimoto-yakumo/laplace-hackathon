"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bot, Pause, Play, Pencil, TrendingUp, TrendingDown, Trash2, Zap, Loader2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getAgentAvatarUrl } from "@/lib/avatar";
import { Link } from "@/i18n/navigation";
import { useWallet } from "@/components/wallet/wallet-provider";
import { useUpdateUserAgent, usePauseUserAgent } from "@/hooks/use-user-agents";
import { AgentConfigSheet } from "@/components/agent/agent-config-sheet";
import type { AgentConfigValues } from "@/components/agent/agent-config-sheet";
import type { RegisteredAgent } from "@/hooks/use-user-registered-agents";
import type {
  AgentTimeHorizon,
  ReasoningStyle,
  RiskTolerance,
  AssetFocus,
  VoiceStyle,
  AnalysisModule,
} from "@/lib/types";

interface AgentCardProps {
  agent: RegisteredAgent;
  walletAddress: string | null;
  isConfirmingRetire: boolean;
  retireLoading: boolean;
  onRetireClick: () => void;
  onRetireConfirm: () => void;
  onRetireCancel: () => void;
  onLiveTradingToggle?: (agentId: string, enabled: boolean) => void;
  onPauseToggle?: (agentId: string, isPaused: boolean) => void;
  onConfigUpdated?: (agentId: string) => void;
}

export function AgentCard({
  agent,
  walletAddress,
  isConfirmingRetire,
  retireLoading,
  onRetireClick,
  onRetireConfirm,
  onRetireCancel,
  onLiveTradingToggle,
  onPauseToggle,
  onConfigUpdated,
}: AgentCardProps) {
  const t = useTranslations("me");
  const tAgent = useTranslations("agent");
  const tLive = useTranslations("liveTrading");
  const { signMessage: walletSignMessage } = useWallet();

  const { mutate: updateAgent, loading: updating } = useUpdateUserAgent(agent.id);
  const { mutate: pauseAgent, loading: pausing } = usePauseUserAgent(agent.id);

  const [liveToggleLoading, setLiveToggleLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(agent.isPaused);

  const returnSign = agent.portfolioReturn >= 0 ? "+" : "";
  const returnPct = (agent.portfolioReturn * 100).toFixed(1);
  const isNegative = agent.portfolioReturn < 0;

  const handleTogglePause = async () => {
    if (!walletSignMessage || !walletAddress) return;
    const result = await pauseAgent({
      isPaused: !isPaused,
      walletAddress,
      signMessage: walletSignMessage,
    });
    if (result) {
      const newPaused = !isPaused;
      setIsPaused(newPaused);
      onPauseToggle?.(agent.id, newPaused);
    }
  };

  const handleSaveConfig = async (values: AgentConfigValues): Promise<boolean> => {
    if (!walletSignMessage || !walletAddress) return false;
    const result = await updateAgent({
      timeHorizon: values.timeHorizon,
      reasoningStyle: values.reasoningStyle,
      riskTolerance: values.riskTolerance,
      assetFocus: values.assetFocus,
      voiceStyle: values.voiceStyle,
      modules: values.modules,
      directives: values.directives || undefined,
      watchlist: values.watchlist.length > 0 ? values.watchlist : undefined,
      alpha: values.alpha || undefined,
      walletAddress,
      signMessage: walletSignMessage,
    });
    if (result) {
      onConfigUpdated?.(agent.id);
      return true;
    }
    return false;
  };

  const configValues: AgentConfigValues = {
    timeHorizon: (agent.timeHorizon as AgentTimeHorizon) ?? "swing",
    reasoningStyle: (agent.reasoningStyle as ReasoningStyle) ?? "fundamental",
    riskTolerance: (agent.riskTolerance as RiskTolerance) ?? "moderate",
    assetFocus: (agent.assetFocus as AssetFocus) ?? "broad",
    voiceStyle: (agent.voiceStyle as VoiceStyle) ?? "analytical",
    modules: (agent.modules as AnalysisModule[]) ?? ["technical", "onchain"],
    directives: agent.userDirectives ?? "",
    watchlist: agent.customWatchlist ?? [],
    alpha: agent.userAlpha ?? "",
  };

  return (
    <div className="rounded-lg border border-border p-3 mb-3">
      {/* Header row */}
      <Link
        href={`/agent/${agent.id}`}
        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
      >
        <Avatar size="sm">
          <AvatarImage src={getAgentAvatarUrl(agent.name)} alt={agent.name} />
          <AvatarFallback><Bot className="size-4" /></AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-foreground truncate">
              {agent.name}
            </p>
            {agent.tier === "user" && (
              <span className="rounded-full bg-primary/15 px-1.5 py-0 text-[10px] font-medium text-primary shrink-0">
                {tAgent("tierUser")}
              </span>
            )}
            {agent.leaderboardRank && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                #{agent.leaderboardRank}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground capitalize">
              {agent.reasoningStyle ?? agent.style}
            </p>
            {!agent.isActive ? (
              <span className="flex items-center gap-0.5 text-[10px] text-destructive">
                <Pause className="size-2.5" />
                {t("statusDeactivated")}
              </span>
            ) : isPaused ? (
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
        </div>
      </Link>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-border">
        <div className="text-center">
          <p className="text-xs font-mono font-medium text-foreground">
            ${agent.portfolioValue.toLocaleString()}
          </p>
          <p className="text-[10px] text-muted-foreground">{t("portfolioValue")}</p>
        </div>
        <div className="text-center">
          <p className={`text-xs font-mono font-medium flex items-center justify-center gap-0.5 ${isNegative ? "text-bearish" : "text-bullish"}`}>
            {isNegative ? <TrendingDown className="size-3" /> : <TrendingUp className="size-3" />}
            {returnSign}{returnPct}%
          </p>
          <p className="text-[10px] text-muted-foreground">{t("sortReturn")}</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-mono font-medium text-foreground">
            {agent.accuracyScore?.toFixed(0) ?? 0}%
          </p>
          <p className="text-[10px] text-muted-foreground">{t("accuracy")}</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-mono font-medium text-foreground">
            {agent.totalPredictions}
          </p>
          <p className="text-[10px] text-muted-foreground">{t("predictions")}</p>
        </div>
      </div>

      {/* Live Trading toggle — visible to agent owner (any tier) */}
      {walletAddress && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap className={`size-3.5 ${agent.liveTradingEnabled ? "text-amber-400" : "text-muted-foreground"}`} />
              <span className="text-xs text-muted-foreground">{tLive("title")}</span>
            </div>
            <button
              disabled={liveToggleLoading || !agent.walletEncryptedKey}
              onClick={async (e) => {
                e.preventDefault();
                if (!walletAddress || !agent.walletEncryptedKey) return;
                setLiveToggleLoading(true);
                try {
                  const res = await fetch(`/api/user-agents/${agent.id}/live-trading`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      wallet_address: walletAddress,
                      enabled: !agent.liveTradingEnabled,
                    }),
                  });
                  if (res.ok) {
                    onLiveTradingToggle?.(agent.id, !agent.liveTradingEnabled);
                  }
                } finally {
                  setLiveToggleLoading(false);
                }
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                agent.liveTradingEnabled ? "bg-amber-500" : "bg-muted"
              }`}
              role="switch"
              aria-checked={agent.liveTradingEnabled}
              aria-label={tLive("title")}
            >
              <span
                className={`pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200 ${
                  agent.liveTradingEnabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          {!agent.walletEncryptedKey && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {tLive("noWallet")}
            </p>
          )}
        </div>
      )}

      {/* Action row: Edit + Pause + Retire */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(e) => { e.preventDefault(); setEditOpen(true); }}
          >
            <Pencil className="size-3" />
            {tAgent("editConfig")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(e) => { e.preventDefault(); handleTogglePause(); }}
            disabled={pausing}
          >
            {pausing ? (
              <Loader2 className="size-3 animate-spin" />
            ) : isPaused ? (
              <Play className="size-3" />
            ) : (
              <Pause className="size-3" />
            )}
            {isPaused ? tAgent("resume") : tAgent("pause")}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {agent.rentalPriceUsdc > 0 && (
            <span className="text-xs text-muted-foreground">${agent.rentalPriceUsdc.toFixed(2)}/mo</span>
          )}
          {/* Retire button — only for user-tier agents */}
          {agent.tier === "user" && (
            <div className="shrink-0">
              {isConfirmingRetire ? (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs px-2"
                    disabled={retireLoading}
                    onClick={(e) => { e.preventDefault(); onRetireConfirm(); }}
                  >
                    {retireLoading ? t("retiring") : t("retireAgent")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2"
                    onClick={(e) => { e.preventDefault(); onRetireCancel(); }}
                  >
                    {t("retireCancel")}
                  </Button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.preventDefault(); onRetireClick(); }}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label={t("retireAgent")}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Config Sheet */}
      <AgentConfigSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        initialValues={configValues}
        onSave={handleSaveConfig}
        saving={updating}
      />
    </div>
  );
}
