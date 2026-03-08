"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { PublicKey } from "@solana/web3.js";
import {
  Loader2,
  X,
  Check,
  TrendingUp,
  Target,
  BarChart3,
  Globe,
  Rocket,
  Shield,
  Coins,
  ArrowLeftRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWallet, useConnection } from "@/components/wallet/wallet-provider";
import { useAdoptAgent, useSubscriptionStatus } from "@/hooks/use-user-agents";
import { buildSubscriptionPaymentTx } from "@/lib/solana/subscription-payment";
import {
  TEMPLATE_KEYS,
  AGENT_TEMPLATES,
  FREE_LLMS,
  PRO_LLMS,
} from "@/lib/agents/templates";
import type {
  AgentTemplate,
  LLMModel,
  SubscriptionPaymentToken,
} from "@/lib/types";

interface AdoptWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string;
  onSuccess?: (agentId: string) => void;
}

const TEMPLATE_ICONS: Record<AgentTemplate, LucideIcon> = {
  day_trader: TrendingUp,
  swing_trader: Target,
  mid_term_investor: BarChart3,
  macro_strategist: Globe,
  meme_hunter: Rocket,
  risk_analyst: Shield,
  defi_specialist: Coins,
  contrarian: ArrowLeftRight,
};

const TEMPLATE_ICON_COLORS: Record<AgentTemplate, string> = {
  day_trader: "text-bullish bg-bullish/10",
  swing_trader: "text-amber-400 bg-amber-400/10",
  mid_term_investor: "text-blue-400 bg-blue-400/10",
  macro_strategist: "text-cyan-400 bg-cyan-400/10",
  meme_hunter: "text-orange-400 bg-orange-400/10",
  risk_analyst: "text-violet-400 bg-violet-400/10",
  defi_specialist: "text-emerald-400 bg-emerald-400/10",
  contrarian: "text-rose-400 bg-rose-400/10",
};

const LLM_LABELS: Record<LLMModel, string> = {
  "claude-sonnet": "Claude Sonnet",
  "gpt-4o": "GPT-4o",
  "gpt-4o-mini": "GPT-4o Mini",
  "gemini-pro": "Gemini Pro",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  minimax: "MiniMax",
  grok: "Grok",
  external: "External",
};

const LLM_INITIALS: Record<LLMModel, string> = {
  "claude-sonnet": "C",
  "gpt-4o": "G",
  "gpt-4o-mini": "Gm",
  "gemini-pro": "Ge",
  deepseek: "D",
  qwen: "Q",
  minimax: "M",
  grok: "Gr",
  external: "E",
};

const LLM_COLORS: Record<LLMModel, string> = {
  "claude-sonnet": "bg-orange-500/20 text-orange-400",
  "gpt-4o": "bg-emerald-500/20 text-emerald-400",
  "gpt-4o-mini": "bg-emerald-500/20 text-emerald-400",
  "gemini-pro": "bg-blue-500/20 text-blue-400",
  deepseek: "bg-cyan-500/20 text-cyan-400",
  qwen: "bg-violet-500/20 text-violet-400",
  minimax: "bg-pink-500/20 text-pink-400",
  grok: "bg-red-500/20 text-red-400",
  external: "bg-zinc-500/20 text-zinc-400",
};

type PaymentPhase = "idle" | "building" | "signing" | "confirming" | "creating";

function StepIndicator({
  current,
  labels,
}: {
  current: number;
  labels: string[];
}) {
  return (
    <div className="flex items-center gap-2 w-full">
      {labels.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === current;
        const isComplete = stepNum < current;
        return (
          <div key={stepNum} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="flex items-center w-full">
              {i > 0 && (
                <div
                  className={`flex-1 h-0.5 ${
                    isComplete || isActive ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
              <div
                className={`size-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                  isComplete
                    ? "bg-primary text-primary-foreground"
                    : isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isComplete ? <Check className="size-3.5" /> : stepNum}
              </div>
              {i < labels.length - 1 && (
                <div
                  className={`flex-1 h-0.5 ${
                    isComplete ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
            <span
              className={`text-[10px] font-medium ${
                isActive || isComplete
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AdoptWizard({
  open,
  onOpenChange,
  walletAddress,
  onSuccess,
}: AdoptWizardProps) {
  const t = useTranslations("adopt");
  const tCommon = useTranslations("common");
  const tTemplates = useTranslations("templates");
  const { mutate, loading, error } = useAdoptAgent();
  const { agentCount } = useSubscriptionStatus(walletAddress);
  const { signTransaction, signMessage: walletSignMessage } = useWallet();
  const { connection } = useConnection();

  const isLocal = typeof window !== "undefined" && window.location.hostname === "localhost";
  const needsPayment = isLocal || agentCount >= 1;
  const totalSteps = needsPayment ? 4 : 3;

  // Wizard state
  const [step, setStep] = useState(1);
  const [template, setTemplate] = useState<AgentTemplate | null>(null);
  const [name, setName] = useState("");
  const [llm, setLlm] = useState<LLMModel>("gemini-pro");
  const [directives, setDirectives] = useState("");
  const [watchlistInput, setWatchlistInput] = useState("");
  const [watchlistTags, setWatchlistTags] = useState<string[]>([]);
  const [alpha, setAlpha] = useState("");
  const [nameError, setNameError] = useState("");
  const defaultPaymentToken: SubscriptionPaymentToken =
    typeof window !== "undefined" && window.location.hostname === "localhost" ? "SOL" : "USDC";
  const [paymentToken, setPaymentToken] = useState<SubscriptionPaymentToken>(defaultPaymentToken);
  const [paymentPhase, setPaymentPhase] = useState<PaymentPhase>("idle");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [checkingName, setCheckingName] = useState(false);

  const isBusy = loading || paymentPhase !== "idle" || checkingName;

  const stepLabels = needsPayment
    ? [t("step1Label"), t("step2Label"), t("step3Label"), t("step4Label")]
    : [t("step1Label"), t("step2Label"), t("step3Label")];

  const resetForm = useCallback(() => {
    setStep(1);
    setTemplate(null);
    setName("");
    setLlm("gemini-pro");
    setDirectives("");
    setWatchlistInput("");
    setWatchlistTags([]);
    setAlpha("");
    setNameError("");
    setPaymentToken("USDC");
    setPaymentPhase("idle");
    setPaymentError(null);
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) resetForm();
      onOpenChange(open);
    },
    [onOpenChange, resetForm]
  );

  const handleNext = useCallback(async () => {
    if (step === 1 && !template) return;
    if (step === 2) {
      const trimmed = name.trim();
      if (!trimmed || trimmed.length < 2 || trimmed.length > 30) {
        setNameError(t("nameRequired"));
        return;
      }
      // Check name uniqueness before proceeding
      setCheckingName(true);
      try {
        const res = await fetch(
          `/api/user-agents/check-name?name=${encodeURIComponent(trimmed)}`
        );
        if (res.status === 409) {
          setNameError(t("nameTaken"));
          return;
        }
      } catch {
        // Network error — allow proceed, server will re-check
      } finally {
        setCheckingName(false);
      }
      setNameError("");
    }
    setStep((s) => Math.min(s + 1, totalSteps));
  }, [step, template, name, t, totalSteps]);

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  const handleAddTag = useCallback(() => {
    const val = watchlistInput.trim().toUpperCase();
    if (val && !watchlistTags.includes(val) && watchlistTags.length < 10) {
      setWatchlistTags((prev) => [...prev, val]);
      setWatchlistInput("");
    }
  }, [watchlistInput, watchlistTags]);

  const handleRemoveTag = useCallback((tag: string) => {
    setWatchlistTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleWatchlistKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag]
  );

  const handleDeploy = useCallback(async () => {
    if (!template) return;
    if (!walletSignMessage) {
      setPaymentError("Wallet does not support message signing");
      return;
    }
    setPaymentError(null);

    let txSignature: string | undefined;

    // --- Payment flow (wallet signing) ---
    if (needsPayment) {
      if (!signTransaction) {
        setPaymentError(t("walletNotConnected"));
        return;
      }

      const amountUsd = paymentToken === "SKR" ? 9.0 : 10.0;

      try {
        // 1. Build transaction
        setPaymentPhase("building");
        const { transaction } = await buildSubscriptionPaymentTx({
          connection,
          payer: new PublicKey(walletAddress),
          amountUsd,
          paymentToken,
        });

        // 2. Sign with wallet
        setPaymentPhase("signing");
        const signed = await signTransaction(transaction);

        // 3. Send directly via RPC (bypass Jupiter broadcast API)
        setPaymentPhase("confirming");
        const signature = await connection.sendRawTransaction(
          signed.serialize(),
          { skipPreflight: false, maxRetries: 3 }
        );

        // 4. Confirm
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");
        await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed"
        );

        txSignature = signature;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setPaymentError(message);
        setPaymentPhase("idle");
        return;
      }
    }

    // --- Create agent ---
    setPaymentPhase("creating");
    const outlook = AGENT_TEMPLATES[template].defaultOutlook;
    const agentId = await mutate({
      walletAddress,
      name: name.trim(),
      template,
      llm,
      outlook,
      directives: directives.trim() || undefined,
      watchlist: watchlistTags.length > 0 ? watchlistTags : undefined,
      alpha: alpha.trim() || undefined,
      signMessage: walletSignMessage,
      ...(needsPayment
        ? {
            paymentToken,
            txSignature,
          }
        : {}),
    });

    setPaymentPhase("idle");

    if (agentId) {
      onSuccess?.(agentId);
      handleOpenChange(false);
    }
  }, [
    template,
    needsPayment,
    signTransaction,
    walletSignMessage,
    connection,
    walletAddress,
    paymentToken,
    mutate,
    name,
    llm,
    directives,
    watchlistTags,
    alpha,
    t,
    onSuccess,
    handleOpenChange,
  ]);

  const phaseLabel = (() => {
    switch (paymentPhase) {
      case "building": return tCommon("txPending");
      case "signing": return t("signing");
      case "confirming": return t("confirming");
      case "creating": return t("deploying");
      default: return null;
    }
  })();

  const displayError = paymentError ?? error;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl flex flex-col h-[85vh] max-h-[85vh]"
      >
        <SheetHeader className="flex-shrink-0 space-y-3">
          <SheetTitle>{t("title")}</SheetTitle>
          <StepIndicator current={step} labels={stepLabels} />
        </SheetHeader>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
          {/* Step 1: Template Selection */}
          {step === 1 && (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                {t("selectTemplate")}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATE_KEYS.map((key) => {
                  const isSelected = template === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTemplate(key)}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 ring-1 ring-primary"
                          : "border-border hover:border-muted-foreground/50"
                      }`}
                    >
                      {(() => {
                        const Icon = TEMPLATE_ICONS[key];
                        return (
                          <div className={`size-9 rounded-lg flex items-center justify-center mb-2 ${TEMPLATE_ICON_COLORS[key]}`}>
                            <Icon className="size-5" />
                          </div>
                        );
                      })()}
                      <p className="text-sm font-semibold text-foreground">
                        {tTemplates(key)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {tTemplates(`${key}_desc`)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Basic Settings */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {t("name")}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError("");
                  }}
                  placeholder={t("namePlaceholder")}
                  maxLength={30}
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {nameError && (
                  <p className="text-xs text-destructive mt-1">{nameError}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {name.length}/30
                </p>
              </div>

              {/* LLM — Card-style selector */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {t("brain")}
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {[...FREE_LLMS, ...PRO_LLMS]
                    .filter(
                      (m) =>
                        m !== "external" &&
                        m !== "qwen" &&
                        m !== "minimax" &&
                        m !== "gpt-4o-mini"
                    )
                    .map((model) => {
                      const isAvailable = model === "gemini-pro";
                      const isSelected = llm === model;
                      return (
                        <button
                          key={model}
                          type="button"
                          onClick={() => {
                            if (isAvailable) setLlm(model);
                          }}
                          disabled={!isAvailable}
                          className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                            !isAvailable
                              ? "border-border opacity-50 cursor-not-allowed"
                              : isSelected
                                ? "border-primary bg-primary/10 ring-1 ring-primary"
                                : "border-border hover:border-muted-foreground/50"
                          }`}
                        >
                          <div
                            className={`size-9 rounded-lg flex items-center justify-center text-sm font-bold ${LLM_COLORS[model]}`}
                          >
                            {LLM_INITIALS[model]}
                          </div>
                          <div className="flex-1 text-left">
                            <span className="text-sm font-medium text-foreground">
                              {LLM_LABELS[model]}
                            </span>
                          </div>
                          {isAvailable ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold border-bullish/30 bg-bullish/10 text-bullish"
                            >
                              {t("free")}
                            </Badge>
                          ) : (
                            <span className="text-[10px] font-medium text-muted-foreground">
                              {t("comingSoon")}
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>

            </div>
          )}

          {/* Step 3: Directives (optional) */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Agent Preview Card */}
              {template && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const Icon = TEMPLATE_ICONS[template];
                      return (
                        <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${TEMPLATE_ICON_COLORS[template]}`}>
                          <Icon className="size-5" />
                        </div>
                      );
                    })()}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {name || t("namePlaceholder")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tTemplates(template)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${LLM_COLORS[llm]}`}
                    >
                      {LLM_LABELS[llm]}
                    </Badge>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {t("laterNote")}
              </p>

              {/* Directives */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {t("directives")}
                </label>
                <textarea
                  value={directives}
                  onChange={(e) => setDirectives(e.target.value)}
                  placeholder={t("directivesPlaceholder")}
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("directivesHint")} ({directives.length}/500)
                </p>
              </div>

              {/* Watchlist */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {t("watchlist")}
                </label>
                {watchlistTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {watchlistTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary"
                      >
                        {tag}
                        <button
                          type="button"
                          aria-label={`Remove ${tag}`}
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-destructive"
                        >
                          <X className="size-3" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  value={watchlistInput}
                  onChange={(e) => setWatchlistInput(e.target.value)}
                  onKeyDown={handleWatchlistKeyDown}
                  onBlur={handleAddTag}
                  placeholder={t("watchlistPlaceholder")}
                  disabled={watchlistTags.length >= 10}
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("watchlistHint")}
                </p>
              </div>

              {/* Alpha */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {t("alpha")}
                </label>
                <textarea
                  value={alpha}
                  onChange={(e) => setAlpha(e.target.value)}
                  placeholder={t("alphaPlaceholder")}
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("alphaHint")} ({alpha.length}/500)
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Payment (only for 2nd+ agent) */}
          {needsPayment && step === 4 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="text-sm font-semibold text-foreground mb-1">
                  {t("subscriptionTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("additionalAgentPrice")}
                </p>
              </div>

              {/* Payment token selector */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setPaymentToken("USDC")}
                  disabled={isBusy}
                  className={`w-full flex items-center gap-3 rounded-xl border p-4 transition-all ${
                    paymentToken === "USDC"
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <div className="size-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm" aria-hidden="true">
                    $
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-foreground">
                      {t("payUsdc")}
                    </p>
                    <p className="text-xs text-muted-foreground">$10.00 {tCommon("perMonth")}</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentToken("SKR")}
                  disabled={isBusy}
                  className={`w-full flex items-center gap-3 rounded-xl border p-4 transition-all ${
                    paymentToken === "SKR"
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <div className="size-10 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 font-bold text-sm" aria-hidden="true">
                    S
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-foreground">
                      {t("paySkr")}
                    </p>
                    <p className="text-xs text-muted-foreground">$9.00 {tCommon("perMonth")}</p>
                  </div>
                  <span className="rounded-full bg-bullish/10 px-2 py-0.5 text-[10px] font-bold text-bullish">
                    {t("skrDiscount")}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentToken("SOL")}
                  disabled={isBusy}
                  className={`w-full flex items-center gap-3 rounded-xl border p-4 transition-all ${
                    paymentToken === "SOL"
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <div className="size-10 rounded-lg bg-gradient-to-br from-[#9945FF]/20 to-[#14F195]/20 flex items-center justify-center font-bold text-sm" aria-hidden="true">
                    <span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">◎</span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-foreground">
                      {t("paySol")}
                    </p>
                    <p className="text-xs text-muted-foreground">$10.00 {tCommon("perMonth")}</p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error display */}
        {displayError && (
          <div className="flex-shrink-0 px-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
              <p className="text-xs text-destructive">{displayError}</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <SheetFooter className="flex-shrink-0">
          <div className="flex gap-3 w-full">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isBusy}
                className="flex-1"
              >
                {t("back")}
              </Button>
            )}
            {step < totalSteps ? (
              <Button
                onClick={handleNext}
                disabled={step === 1 && !template}
                className="flex-1"
              >
                {t("next")}
              </Button>
            ) : (
              <Button
                onClick={handleDeploy}
                disabled={isBusy}
                className="flex-1"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {phaseLabel ?? t("deploying")}
                  </>
                ) : (
                  needsPayment ? t("payAndCreate") : t("deploy")
                )}
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
