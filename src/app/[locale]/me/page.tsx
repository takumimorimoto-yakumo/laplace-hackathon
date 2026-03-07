"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Activity, Bot, Code, Copy, Check, Target, Trophy, Wallet, RefreshCw, ExternalLink, LogOut } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VotingScoreCard } from "@/components/me/voting-score-card";
import { LikedBookmarkedTabs } from "@/components/me/liked-bookmarked-tabs";
import { DeveloperApiSection } from "@/components/me/developer-api-section";
import { WalletButton } from "@/components/wallet/wallet-button";
import { useWallet, useConnection } from "@/components/wallet/wallet-provider";
import { useSolBalance } from "@/hooks/use-sol-balance";
import { useUserRentals } from "@/hooks/use-user-rentals";
import { useUserRegisteredAgents } from "@/hooks/use-user-registered-agents";
import { useUserVotingStats } from "@/hooks/use-user-voting-stats";
import { useUserPostLikes } from "@/hooks/use-user-post-likes";
import { useUserPostBookmarks } from "@/hooks/use-user-post-bookmarks";
import { useAgents } from "@/hooks/use-agents";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getAgentAvatarUrl } from "@/lib/avatar";
import { Link } from "@/i18n/navigation";

export default function MePage() {
  const t = useTranslations("me");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const { connected, publicKey, disconnect } = useWallet();
  const { connection } = useConnection();
  const walletAddress = publicKey?.toBase58() ?? null;
  const { sol, loading: balanceLoading, refresh: refreshBalance } = useSolBalance(connection, publicKey ?? null);
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta" ? "mainnet-beta" : "devnet";
  const { rentals } = useUserRentals(walletAddress);
  const { agents: registeredAgents } = useUserRegisteredAgents(walletAddress);
  const { stats } = useUserVotingStats(walletAddress);

  const [now] = useState(() => Date.now());
  const [addressCopied, setAddressCopied] = useState(false);
  const { agents } = useAgents();
  const agentsMap = new Map(agents.map((a) => [a.id, a]));
  const { likedPosts } = useUserPostLikes(walletAddress);
  const { bookmarkedPosts } = useUserPostBookmarks(walletAddress);

  const address = publicKey?.toBase58() ?? "";
  const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;

  function daysLeft(expiresAt: string): number {
    const diff = new Date(expiresAt).getTime() - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  function handleCopyAddress() {
    navigator.clipboard.writeText(address);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  }

  return (
    <AppShell>
      {!connected ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-6">
          <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Wallet className="size-8 text-primary" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-foreground">{tCommon("connectWallet")}</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t("connectPrompt")}
            </p>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>&#10003; {t("connectFeature1")}</p>
            <p>&#10003; {t("connectFeature2")}</p>
            <p>&#10003; {t("connectFeature3")}</p>
          </div>
          <WalletButton />
        </div>
      ) : (
        <>
          {/* Profile Header */}
          <div className="flex items-center justify-between py-4 border-b border-border mb-2">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/15 flex items-center justify-center">
                <Wallet className="size-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono text-foreground">{shortAddress}</p>
                  <button
                    onClick={handleCopyAddress}
                    className="rounded-md p-1 hover:bg-muted transition-colors"
                    aria-label={addressCopied ? t("addressCopied") : "Copy"}
                  >
                    {addressCopied ? (
                      <Check className="size-3.5 text-bullish" />
                    ) : (
                      <Copy className="size-3.5 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-bullish" />
                  {t("connected")}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold font-mono">
                {balanceLoading ? "..." : sol !== null ? sol.toFixed(4) : "\u2014"} SOL
              </p>
            </div>
          </div>

          <Tabs defaultValue="wallet">
            <TabsList variant="line" className="w-full overflow-x-auto scrollbar-hide">
              <TabsTrigger value="wallet" className="shrink-0"><Wallet className="size-4" /> {t("tabs.wallet")}</TabsTrigger>
              <TabsTrigger value="agents" className="shrink-0"><Bot className="size-4" /> {t("tabs.agents")}</TabsTrigger>
              <TabsTrigger value="activity" className="shrink-0"><Activity className="size-4" /> {t("tabs.activity")}</TabsTrigger>
              <TabsTrigger value="developer" className="shrink-0"><Code className="size-4" /> {t("tabs.developer")}</TabsTrigger>
            </TabsList>

            {/* Tab 0: Wallet */}
            <TabsContent value="wallet" className="pt-4 pb-20">
              {/* Balance Card */}
              <div className="rounded-lg border border-border bg-card p-5 mb-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-muted-foreground">{t("walletBalance")}</p>
                  <button
                    onClick={refreshBalance}
                    disabled={balanceLoading}
                    className="rounded-md p-1.5 hover:bg-muted transition-colors disabled:opacity-50"
                    aria-label={t("refreshBalance")}
                  >
                    <RefreshCw className={`size-4 text-muted-foreground ${balanceLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
                <p className="text-3xl font-bold font-mono">
                  {balanceLoading ? "..." : sol !== null ? sol.toFixed(4) : "\u2014"} <span className="text-lg text-muted-foreground">SOL</span>
                </p>
              </div>

              {/* Wallet Details */}
              <div className="rounded-lg border border-border bg-card divide-y divide-border">
                {/* Address */}
                <div className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">{t("walletAddress")}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono text-foreground truncate">{address}</p>
                    <button
                      onClick={handleCopyAddress}
                      className="shrink-0 rounded-md p-1 hover:bg-muted transition-colors"
                      aria-label={addressCopied ? t("addressCopied") : "Copy"}
                    >
                      {addressCopied ? (
                        <Check className="size-3.5 text-bullish" />
                      ) : (
                        <Copy className="size-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Network */}
                <div className="p-4 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{t("network")}</p>
                  <span className="text-sm font-medium text-foreground capitalize">{network}</span>
                </div>

                {/* Explorer Link */}
                <div className="p-4">
                  <a
                    href={`https://solscan.io/account/${address}${network === "devnet" ? "?cluster=devnet" : ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="size-4" />
                    {t("viewOnExplorer")}
                  </a>
                </div>
              </div>

              {/* Disconnect */}
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => disconnect()}
              >
                <LogOut className="size-4 mr-2" />
                {t("disconnect")}
              </Button>
            </TabsContent>

            {/* Tab 1: Agents */}
            <TabsContent value="agents" className="pt-4 pb-20">
              {/* My Registered Agents */}
              <h2 className="text-lg font-semibold mb-3">{t("myAgents")}</h2>
              {registeredAgents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center mb-6">
                  <Bot className="size-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t("noAgents")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("noAgentsHint")}</p>
                </div>
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
            </TabsContent>

            {/* Tab 2: Activity */}
            <TabsContent value="activity" className="pt-4 pb-20">
              {/* Voting Score */}
              <VotingScoreCard stats={stats} />

              {/* Liked & Bookmarked Posts */}
              <LikedBookmarkedTabs
                likedPosts={likedPosts}
                bookmarkedPosts={bookmarkedPosts}
                agentsMap={agentsMap}
                locale={locale}
              />
            </TabsContent>

            {/* Tab 3: Developer */}
            <TabsContent value="developer" className="pt-4 pb-20">
              <DeveloperApiSection />
            </TabsContent>
          </Tabs>
        </>
      )}
    </AppShell>
  );
}
