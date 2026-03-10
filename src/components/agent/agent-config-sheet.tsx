"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, X, ChevronDown, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ConfigSection } from "@/components/agent/config-section";
import { ModuleSelector } from "@/components/agent/module-selector";
import type {
  AgentTimeHorizon,
  ReasoningStyle,
  RiskTolerance,
  AssetFocus,
  VoiceStyle,
  AnalysisModule,
} from "@/lib/types";

export interface AgentConfigValues {
  timeHorizon: AgentTimeHorizon;
  reasoningStyle: ReasoningStyle;
  riskTolerance: RiskTolerance;
  assetFocus: AssetFocus;
  voiceStyle: VoiceStyle;
  modules: AnalysisModule[];
  directives: string;
  watchlist: string[];
  alpha: string;
}

interface AgentConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues: AgentConfigValues;
  onSave: (values: AgentConfigValues) => Promise<boolean>;
  saving?: boolean;
}

export function AgentConfigSheet({
  open,
  onOpenChange,
  initialValues,
  onSave,
  saving = false,
}: AgentConfigSheetProps) {
  const t = useTranslations("agent");
  const tAdopt = useTranslations("adopt");
  const tConfig = useTranslations("agentConfig");

  const [timeHorizon, setTimeHorizon] = useState<AgentTimeHorizon>(initialValues.timeHorizon);
  const [reasoningStyle, setReasoningStyle] = useState<ReasoningStyle>(initialValues.reasoningStyle);
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>(initialValues.riskTolerance);
  const [assetFocus, setAssetFocus] = useState<AssetFocus>(initialValues.assetFocus);
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>(initialValues.voiceStyle);
  const [modules, setModules] = useState<AnalysisModule[]>(initialValues.modules);

  const [directives, setDirectives] = useState(initialValues.directives);
  const [watchlistTags, setWatchlistTags] = useState<string[]>(initialValues.watchlist);
  const [watchlistInput, setWatchlistInput] = useState("");
  const [alpha, setAlpha] = useState(initialValues.alpha);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleAddTag = () => {
    const val = watchlistInput.trim().toUpperCase();
    if (val && !watchlistTags.includes(val) && watchlistTags.length < 10) {
      setWatchlistTags((prev) => [...prev, val]);
      setWatchlistInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setWatchlistTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleWatchlistKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = async () => {
    const result = await onSave({
      timeHorizon,
      reasoningStyle,
      riskTolerance,
      assetFocus,
      voiceStyle,
      modules,
      directives: directives.trim(),
      watchlist: watchlistTags,
      alpha: alpha.trim(),
    });
    if (result) {
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onOpenChange(false);
      }, 1200);
    }
  };

  const timeHorizonOptions = (["scalp", "intraday", "swing", "position", "long_term"] as const).map((val) => ({
    value: val,
    label: tConfig(val),
    description: tConfig(`${val}Desc`),
  }));

  const reasoningOptions = (["momentum", "contrarian", "fundamental", "quantitative", "narrative"] as const).map((val) => ({
    value: val,
    label: tConfig(val),
    description: tConfig(`${val}Desc`),
  }));

  const riskOptions = (["conservative", "moderate", "aggressive", "degen"] as const).map((val) => ({
    value: val,
    label: tConfig(val),
    description: tConfig(`${val}Desc`),
  }));

  const voiceOptions = (["concise", "analytical", "structural", "provocative", "educational"] as const).map((val) => ({
    value: val,
    label: tConfig(val),
    description: tConfig(`${val}Desc`),
  }));

  const assetOptions = (["blue_chip", "defi_tokens", "meme", "infrastructure", "broad"] as const).map((val) => ({
    value: val,
    label: tConfig(val),
    description: tConfig(`${val}Desc`),
  }));

  const moduleOptions = (["technical", "onchain", "defi", "sentiment", "macro_regulatory", "risk", "news", "cross_chain"] as const).map((mod) => ({
    value: mod,
    label: mod.replace("_", " "),
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl flex flex-col h-[90vh] max-h-[90vh]"
      >
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>{t("editConfig")}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-5 min-h-0">
          <ConfigSection
            label={tConfig("timeHorizon")}
            description={tConfig("timeHorizonDesc")}
            options={timeHorizonOptions}
            value={timeHorizon}
            onChange={(v) => setTimeHorizon(v as AgentTimeHorizon)}
            columns={5}
          />

          <ConfigSection
            label={tConfig("reasoningStyle")}
            description={tConfig("reasoningStyleDesc")}
            options={reasoningOptions}
            value={reasoningStyle}
            onChange={(v) => setReasoningStyle(v as ReasoningStyle)}
            columns={5}
          />

          <ConfigSection
            label={tConfig("riskTolerance")}
            description={tConfig("riskToleranceDesc")}
            options={riskOptions}
            value={riskTolerance}
            onChange={(v) => setRiskTolerance(v as RiskTolerance)}
            columns={4}
          />

          <ConfigSection
            label={tConfig("voiceStyle")}
            description={tConfig("voiceStyleDesc")}
            options={voiceOptions}
            value={voiceStyle}
            onChange={(v) => setVoiceStyle(v as VoiceStyle)}
            columns={5}
          />

          <ConfigSection
            label={tConfig("assetFocus")}
            description={tConfig("assetFocusDesc")}
            options={assetOptions}
            value={assetFocus}
            onChange={(v) => setAssetFocus(v as AssetFocus)}
            columns={5}
          />

          <ModuleSelector
            label={tConfig("modules")}
            description={tConfig("modulesDesc")}
            options={moduleOptions}
            selected={modules}
            onChange={(sel) => setModules(sel as AnalysisModule[])}
            min={1}
            max={3}
          />

          {/* Advanced Settings */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className={`size-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              {t("directivesSection")}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    {tAdopt("directives")}
                  </label>
                  <textarea
                    value={directives}
                    onChange={(e) => setDirectives(e.target.value)}
                    placeholder={tAdopt("directivesPlaceholder")}
                    maxLength={500}
                    rows={3}
                    className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {tAdopt("directivesHint")} ({directives.length}/500)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    {tAdopt("watchlist")}
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
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-destructive"
                          >
                            <X className="size-3" />
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
                    placeholder={tAdopt("watchlistPlaceholder")}
                    disabled={watchlistTags.length >= 10}
                    className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {tAdopt("watchlistHint")}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    {tAdopt("alpha")}
                  </label>
                  <textarea
                    value={alpha}
                    onChange={(e) => setAlpha(e.target.value)}
                    placeholder={tAdopt("alphaPlaceholder")}
                    maxLength={500}
                    rows={3}
                    className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {tAdopt("alphaHint")} ({alpha.length}/500)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="flex-shrink-0">
          <Button
            onClick={handleSave}
            disabled={saving || saved}
            className="w-full"
          >
            {saved ? (
              <>
                <Check className="size-4" />
                {t("configSaved")}
              </>
            ) : saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {tAdopt("deploying")}
              </>
            ) : (
              t("editConfig")
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
