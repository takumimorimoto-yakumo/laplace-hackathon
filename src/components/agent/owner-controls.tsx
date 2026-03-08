"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Pause, Play, Loader2, X, Star } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/components/wallet/wallet-provider";
import { useUpdateUserAgent, usePauseUserAgent } from "@/hooks/use-user-agents";

interface OwnerControlsProps {
  agentId: string;
  ownerWallet: string;
  isPaused: boolean;
  currentDirectives?: string;
  currentWatchlist?: string[];
  currentAlpha?: string;
}

export function OwnerControls({
  agentId,
  ownerWallet,
  isPaused: initialPaused,
  currentDirectives,
  currentWatchlist,
  currentAlpha,
}: OwnerControlsProps) {
  const t = useTranslations("agent");
  const tAdopt = useTranslations("adopt");
  const { publicKey, signMessage: walletSignMessage } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  const { mutate: updateAgent, loading: updating } = useUpdateUserAgent(agentId);
  const { mutate: pauseAgent, loading: pausing } = usePauseUserAgent(agentId);

  const [editOpen, setEditOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(initialPaused);
  const [directives, setDirectives] = useState(currentDirectives ?? "");
  const [watchlistTags, setWatchlistTags] = useState<string[]>(currentWatchlist ?? []);
  const [watchlistInput, setWatchlistInput] = useState("");
  const [alpha, setAlpha] = useState(currentAlpha ?? "");

  // Only show if wallet matches
  if (!walletAddress || walletAddress !== ownerWallet) {
    return null;
  }

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
    if (!walletSignMessage || !walletAddress) return;
    const result = await updateAgent({
      directives: directives.trim() || undefined,
      watchlist: watchlistTags.length > 0 ? watchlistTags : undefined,
      alpha: alpha.trim() || undefined,
      walletAddress,
      signMessage: walletSignMessage,
    });
    if (result) {
      setEditOpen(false);
    }
  };

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
        {t("editDirectives")}
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

      {/* Edit Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl flex flex-col h-[70vh] max-h-[70vh]"
        >
          <SheetHeader className="flex-shrink-0">
            <SheetTitle>{t("editDirectives")}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6 min-h-0">
            {/* Directives */}
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

            {/* Watchlist */}
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

            {/* Alpha */}
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

          <SheetFooter className="flex-shrink-0">
            <Button
              onClick={handleSave}
              disabled={updating}
              className="w-full"
            >
              {updating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {tAdopt("deploying")}
                </>
              ) : (
                tAdopt("deploy")
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
