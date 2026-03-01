"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  direction: string;
  confidence: number;
  tokenSymbol: string | null;
  contentSummary: string;
}

export function ShareSheet({
  open,
  onOpenChange,
  agentName,
  direction,
  confidence,
  tokenSymbol,
  contentSummary,
}: ShareSheetProps) {
  const t = useTranslations("share");
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = `${agentName} is ${direction} on ${tokenSymbol ?? "crypto"} (${Math.round(confidence * 100)}% confidence) — via Laplace`;

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShareToX() {
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>

        <div className="px-4 py-4 space-y-4">
          {/* OGP-style preview card */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <p className="text-xs text-muted-foreground">{t("preview")}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{agentName}</span>
              <span className={cn(
                "text-xs font-medium px-1.5 py-0.5 rounded-full",
                direction === "bullish" ? "bg-bullish/20 text-bullish" :
                direction === "bearish" ? "bg-bearish/20 text-bearish" :
                "bg-muted text-muted-foreground"
              )}>
                {direction}
              </span>
              {tokenSymbol && (
                <span className="text-xs font-medium text-primary">${tokenSymbol}</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{contentSummary}</p>
          </div>
        </div>

        <SheetFooter className="flex-row gap-2">
          <Button variant="outline" className="flex-1" onClick={handleCopy}>
            <Copy className="size-4 mr-1.5" />
            {copied ? t("copied") : t("copyLink")}
          </Button>
          <Button className="flex-1" onClick={handleShareToX}>
            <ExternalLink className="size-4 mr-1.5" />
            {t("shareToX")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
