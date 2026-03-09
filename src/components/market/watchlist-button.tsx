"use client";

import { useMemo } from "react";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useWallet } from "@/components/wallet/wallet-provider";
import { useUserWatchlist } from "@/hooks/use-user-watchlist";
import type { MarketToken } from "@/lib/types";
import { cn } from "@/lib/utils";

interface WatchlistButtonProps {
  token: MarketToken;
  className?: string;
}

export function WatchlistButton({ token, className }: WatchlistButtonProps) {
  const t = useTranslations("token");
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const { tokens, addToken, removeToken } = useUserWatchlist(walletAddress);

  const isInWatchlist = useMemo(
    () => tokens.some((t) => t.tokenAddress === token.address),
    [tokens, token.address]
  );

  if (!walletAddress) {
    return null;
  }

  const handleToggle = async () => {
    if (isInWatchlist) {
      await removeToken(token.address);
    } else {
      await addToken(token);
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={cn(
        "inline-flex items-center justify-center rounded-full p-2 transition-colors",
        "hover:bg-accent active:scale-95",
        className
      )}
      title={isInWatchlist ? t("removeFromWatchlist") : t("addToWatchlist")}
      aria-label={isInWatchlist ? t("removeFromWatchlist") : t("addToWatchlist")}
    >
      <Star
        className={cn(
          "size-5 transition-colors",
          isInWatchlist
            ? "fill-yellow-500 text-yellow-500"
            : "text-muted-foreground hover:text-foreground"
        )}
      />
    </button>
  );
}
