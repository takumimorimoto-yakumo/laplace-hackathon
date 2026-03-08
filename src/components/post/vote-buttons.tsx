"use client";

import { useState, useCallback } from "react";
import { MessageSquare, ThumbsUp, ThumbsDown, Share } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShareSheet } from "./share-sheet-provider";
import { useWallet } from "@/components/wallet/wallet-provider";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface VoteButtonsProps {
  postId: string;
  upvotes: number;
  downvotes: number;
  replyCount?: number;
  threadOpen?: boolean;
  onReplyClick?: () => void;
  className?: string;
  agentName?: string;
  direction?: string;
  confidence?: number;
  tokenSymbol?: string | null;
  contentSummary?: string;
}

export function VoteButtons({
  postId,
  upvotes,
  downvotes,
  replyCount,
  threadOpen,
  onReplyClick,
  className,
  agentName = "",
  direction = "neutral",
  confidence = 0,
  tokenSymbol = null,
  contentSummary = "",
}: VoteButtonsProps) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const { publicKey } = useWallet();
  const { openShareSheet } = useShareSheet();
  const t = useTranslations("timeline");
  const tCommon = useTranslations("common");

  const handleVote = useCallback(
    async (dir: "up" | "down") => {
      if (!publicKey) {
        toast.error(tCommon("connectToVote"));
        return;
      }

      const previousVote = vote;
      const newVote = previousVote === dir ? null : dir;
      setVote(newVote);

      if (newVote === null) return;

      try {
        const res = await fetch("/api/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId,
            direction: dir,
            walletAddress: publicKey.toBase58(),
          }),
        });

        if (!res.ok) {
          throw new Error("Vote request failed");
        }
      } catch {
        setVote(previousVote);
        toast.error(tCommon("voteFailed"));
      }
    },
    [publicKey, vote, postId, tCommon]
  );

  const displayUp = vote === "up" ? upvotes + 1 : upvotes;
  const displayDown = vote === "down" ? downvotes + 1 : downvotes;

  return (
    <div className={cn("flex items-center justify-between max-w-[300px] text-muted-foreground", className)}>
      {/* Reply count */}
      <button
        type="button"
        onClick={onReplyClick}
        disabled={!replyCount}
        aria-label={t("reply")}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs rounded-md px-2 py-1 transition-colors min-h-[44px] min-w-[44px] justify-center",
          replyCount ? "hover:text-primary cursor-pointer" : "cursor-default",
          threadOpen && "text-primary"
        )}
      >
        <MessageSquare className="size-4" />
        {replyCount != null && replyCount > 0 && <span>{replyCount}</span>}
      </button>

      {/* Upvote */}
      <button
        type="button"
        onClick={() => handleVote("up")}
        aria-label={t("upvote")}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs rounded-md px-2 py-1 transition-colors hover:text-bullish cursor-pointer min-h-[44px] min-w-[44px] justify-center",
          vote === "up" && "text-bullish"
        )}
      >
        <ThumbsUp className="size-4" />
        <span>{displayUp}</span>
      </button>

      {/* Downvote */}
      <button
        type="button"
        onClick={() => handleVote("down")}
        aria-label={t("downvote")}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs rounded-md px-2 py-1 transition-colors hover:text-bearish cursor-pointer min-h-[44px] min-w-[44px] justify-center",
          vote === "down" && "text-bearish"
        )}
      >
        <ThumbsDown className="size-4" />
        <span>{displayDown}</span>
      </button>

      {/* Share */}
      <button
        type="button"
        onClick={() => openShareSheet({ agentName, direction, confidence, tokenSymbol: tokenSymbol ?? null, contentSummary })}
        aria-label={t("sharePost")}
        className="inline-flex items-center text-xs rounded-md px-2 py-1 hover:text-primary cursor-pointer transition-colors min-h-[44px] min-w-[44px] justify-center"
      >
        <Share className="size-4" />
      </button>
    </div>
  );
}
