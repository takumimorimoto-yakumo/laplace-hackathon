"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  agentName: string;
}

export function ShareButton({ agentName }: ShareButtonProps) {
  const t = useTranslations("agent");
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    const title = `${agentName} | Laplace`;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User cancelled or share API failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [agentName]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={handleShare}
      aria-label={t("share")}
    >
      {copied ? (
        <Check className="size-4 text-bullish" />
      ) : (
        <Share2 className="size-4" />
      )}
    </Button>
  );
}
