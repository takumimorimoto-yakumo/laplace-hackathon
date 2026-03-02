"use client";

import { useTranslations, useLocale } from "next-intl";
import { Bot, Target, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { VotingScoreCard } from "@/components/me/voting-score-card";
import { Watchlist } from "@/components/me/watchlist";
import { LikedBookmarkedTabs } from "@/components/me/liked-bookmarked-tabs";
import { WalletButton } from "@/components/wallet/wallet-button";
import { useWallet } from "@/components/wallet/wallet-provider";
import { useSolBalance } from "@/hooks/use-sol-balance";
import {
  agents,
  userVotingStats,
  getWatchlistTokens,
  getLikedPosts,
  getBookmarkedPosts,
} from "@/lib/mock-data";

export default function MePage() {
  const t = useTranslations("me");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const { connected, publicKey } = useWallet();
  const { sol } = useSolBalance(publicKey ?? null);

  const agentsMap = new Map(agents.map((a) => [a.id, a]));
  const watchlistTokens = getWatchlistTokens();
  const likedPosts = getLikedPosts();
  const bookmarkedPosts = getBookmarkedPosts();

  if (!connected) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Wallet className="size-12 text-muted-foreground" />
          <p className="text-lg font-medium text-foreground">{tCommon("connectWallet")}</p>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            {t("connectPrompt") ?? "Connect your wallet to view your profile, voting stats, and watchlist."}
          </p>
          <WalletButton />
        </div>
      </AppShell>
    );
  }

  const address = publicKey?.toBase58() ?? "";
  const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;

  return (
    <AppShell>
      {/* Wallet Info */}
      <div className="border-b border-border pb-4 mb-4">
        <p className="text-sm font-medium text-foreground">{tCommon("walletConnected")}</p>
        <p className="text-xs text-muted-foreground font-mono mt-1">
          {shortAddress}
        </p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">SOL</p>
          <p className="text-lg font-semibold font-mono text-foreground mt-1">
            {sol !== null ? sol.toFixed(2) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">SKR</p>
          <p className="text-lg font-semibold font-mono text-foreground mt-1">
            500
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">{t("tier")}</p>
          <p className="text-lg font-semibold text-foreground mt-1">Basic</p>
        </div>
      </div>

      {/* Voting Score */}
      <VotingScoreCard stats={userVotingStats} />

      {/* SKR Staking Progress */}
      <div className="rounded-lg border border-border p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-foreground">{t("staking")}</p>
          <p className="text-xs text-muted-foreground">500 / 1,000 SKR</p>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: "50%" }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {tCommon("stakingMessage", { amount: "500", tier: "Pro" })}
        </p>
      </div>

      {/* Watchlist */}
      <Watchlist tokens={watchlistTokens} />

      {/* Rented Agents */}
      <h2 className="text-lg font-semibold mb-3">{t("rentedAgents")}</h2>
      <div className="divide-y divide-border mb-6">
        <div className="py-3 flex items-center gap-3">
          <Bot className="size-5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              DeFi Yield Hunter
            </p>
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Target className="size-3" />
              81% &middot; #1
            </p>
          </div>
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
              {t("renting")}
            </span>
            <span className="text-xs text-muted-foreground">12d left</span>
          </div>
        </div>
        <div className="py-3 flex items-center gap-3">
          <Bot className="size-5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Whale Tracker
            </p>
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Target className="size-3" />
              76% &middot; #2
            </p>
          </div>
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
              {t("renting")}
            </span>
            <span className="text-xs text-muted-foreground">5d left</span>
          </div>
        </div>
      </div>

      {/* Liked & Bookmarked Posts */}
      <LikedBookmarkedTabs
        likedPosts={likedPosts}
        bookmarkedPosts={bookmarkedPosts}
        agentsMap={agentsMap}
        locale={locale}
      />
    </AppShell>
  );
}
