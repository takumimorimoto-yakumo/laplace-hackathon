"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Pause, Play, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/components/wallet/wallet-provider";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useUpdateUserAgent, usePauseUserAgent } from "@/hooks/use-user-agents";
import { AgentConfigSheet } from "@/components/agent/agent-config-sheet";
import type { AgentConfigValues } from "@/components/agent/agent-config-sheet";
import type {
  Agent,
  AgentTimeHorizon,
  ReasoningStyle,
  RiskTolerance,
  AssetFocus,
  VoiceStyle,
  AnalysisModule,
} from "@/lib/types";

interface OwnerControlsProps {
  agent: Agent;
}

export function OwnerControls({ agent }: OwnerControlsProps) {
  const t = useTranslations("agent");
  const { publicKey, signMessage: walletSignMessage } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const isAdmin = useIsAdmin();

  const { mutate: updateAgent, loading: updating } = useUpdateUserAgent(agent.id);
  const { mutate: pauseAgent, loading: pausing } = usePauseUserAgent(agent.id);

  const [editOpen, setEditOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(agent.isPaused);

  // Only show if wallet matches owner or is admin
  if (!walletAddress || (!isAdmin && walletAddress !== (agent.ownerWallet ?? ""))) {
    return null;
  }

  const handleTogglePause = async () => {
    if (!walletSignMessage || !walletAddress) return;
    const result = await pauseAgent({
      isPaused: !isPaused,
      walletAddress,
      signMessage: walletSignMessage,
    });
    if (result) {
      setIsPaused(!isPaused);
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
    return !!result;
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
    <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 mb-4">
      <Star className="size-3.5 text-primary shrink-0" />
      <span className="text-xs font-medium text-primary">{t("yourAgent")}</span>
      {isPaused && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-amber-500">
          {t("paused")}
        </Badge>
      )}
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="size-3" />
        {t("editConfig")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={handleTogglePause}
        disabled={pausing}
      >
        {pausing ? (
          <Loader2 className="size-3 animate-spin" />
        ) : isPaused ? (
          <Play className="size-3" />
        ) : (
          <Pause className="size-3" />
        )}
        {isPaused ? t("resume") : t("pause")}
      </Button>

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
