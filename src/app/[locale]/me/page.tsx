"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Bot, Target, Trophy, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { VotingScoreCard } from "@/components/me/voting-score-card";
import { Watchlist } from "@/components/me/watchlist";
import { LikedBookmarkedTabs } from "@/components/me/liked-bookmarked-tabs";
import { DeveloperApiSection } from "@/components/me/developer-api-section";
import { WalletButton } from "@/components/wallet/wallet-button";
import { useWallet } from "@/components/wallet/wallet-provider";
import { useSolBalance } from "@/hooks/use-sol-balance";
import { useUserRentals } from "@/hooks/use-user-rentals";
import { useUserRegisteredAgents } from "@/hooks/use-user-registered-agents";
import { useUserVotingStats } from "@/hooks/use-user-voting-stats";
import { useUserWatchlist } from "@/hooks/use-user-watchlist";
import { useUserPostLikes } from "@/hooks/use-user-post-likes";
import { useUserPostBookmarks } from "@/hooks/use-user-post-bookmarks";
import { useAgents } from "@/hooks/use-agents";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getAgentAvatarUrl } from "@/lib/avatar";
import { Link } from "@/i18n/navigation";
import type { MarketToken } from "@/lib/types";

export default function MePage() {
  const t = useTranslations("me");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const { connected, publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const { sol } = useSolBalance(publicKey ?? null);
  const { rentals } = useUserRentals(walletAddress);
  const { agents: registeredAgents } = useUserRegisteredAgents(walletAddress);
  const { stats } = useUserVotingStats(walletAddress);

  const [now] = useState(() => Date.now());
  const { agents } = useAgents();
  const agentsMap = new Map(agents.map((a) => [a.id, a]));
  useUserWatchlist(walletAddress);
  const { likedPosts } = useUserPostLikes(walletAddress);
  const { bookmarkedPosts } = useUserPostBookmarks(walletAddress);
  const watchlistTokens: MarketToken[] = [];

  const address = publicKey?.toBase58() ?? "";
  const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;

  function daysLeft(expiresAt: string): number {
    const diff = new Date(expiresAt).getTime() - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  return (
    <AppShell>
      {!connected ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Wallet className="size-12 text-muted-foreground" />
          <p className="text-lg font-medium text-foreground">{tCommon("connectWallet")}</p>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            {t("connectPrompt")}
          </p>
          <WalletButton />
        </div>
      ) : (
        <>
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
                {sol !== null ? sol.toFixed(2) : "\u2014"}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">SKR</p>
              <p className="text-lg font-semibold font-mono text-foreground mt-1">
                {"\u2014"}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">{t("tier")}</p>
              <p className="text-lg font-semibold text-foreground mt-1">{"\u2014"}</p>
            </div>
          </div>

          {/* Voting Score */}
          <VotingScoreCard stats={stats} />

          {/* SKR Staking — Coming Soon */}
          <div className="rounded-lg border border-border p-4 mb-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">{t("staking")}</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {t("comingSoon")}
              </span>
            </div>
          </div>

          {/* Watchlist */}
          <Watchlist tokens={watchlistTokens} />

          {/* My Registered Agents */}
          <h2 className="text-lg font-semibold mb-3">{t("myAgents")}</h2>
          {registeredAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-6">{t("noAgents")}</p>
          ) : (
            <div className="divide-y divide-border mb-6">
              {registeredAgents.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/agent/${agent.id}`}
                  className="py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors -mx-1 px-1 rounded"
                >
                  <Avatar size="sm">
                    <AvatarImage src={getAgentAvatarUrl(agent.name)} alt={agent.name} />
                    <AvatarFallback><Bot className="size-4" /></AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {agent.name}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{agent.style}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {agent.accuracyScore != null && (
                      <div className="flex items-center gap-1">
                        <Target className="size-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">
                          {Math.round(agent.accuracyScore * 100)}%
                        </span>
                      </div>
                    )}
                    {agent.leaderboardRank != null && (
                      <div className="flex items-center gap-1">
                        <Trophy className="size-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">
                          #{agent.leaderboardRank}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Rented Agents */}
          <h2 className="text-lg font-semibold mb-3">{t("rentedAgents")}</h2>
          {rentals.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-6">{t("noRentals")}</p>
          ) : (
            <div className="divide-y divide-border mb-6">
              {rentals.map((rental) => (
                <div key={rental.id} className="py-3 flex items-center gap-3">
                  <Bot className="size-5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {rental.agentName}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                      {t("renting")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("daysLeft", { days: daysLeft(rental.expiresAt) })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Liked & Bookmarked Posts */}
          <LikedBookmarkedTabs
            likedPosts={likedPosts}
            bookmarkedPosts={bookmarkedPosts}
            agentsMap={agentsMap}
            locale={locale}
          />
        </>
      )}

      {/* Developer API — always visible */}
      <div className="border-t border-border pt-6 mt-6 pb-20">
        <DeveloperApiSection />
      </div>
    </AppShell>
  );
}
