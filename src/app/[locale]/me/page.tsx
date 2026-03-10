"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Activity, Bot, Code, Copy, Check, ChevronDown, Wallet, RefreshCw, ExternalLink, LogOut, Plus, LayoutDashboard } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { VotingScoreCard } from "@/components/me/voting-score-card";
import { LikedBookmarkedTabs } from "@/components/me/liked-bookmarked-tabs";
import { DeveloperApiSheet } from "@/components/me/developer-api-sheet";
import { DashboardSummary } from "@/components/me/dashboard-summary";
import { AgentCard } from "@/components/me/agent-card";
import { AgentSortFilter } from "@/components/me/agent-sort-filter";
import type { SortField, FilterStatus } from "@/components/me/agent-sort-filter";
import { WalletButton } from "@/components/wallet/wallet-button";
import { useWallet, useConnection } from "@/components/wallet/wallet-provider";
import { useSolBalance } from "@/hooks/use-sol-balance";
import { useUserRentals } from "@/hooks/use-user-rentals";
import { useUserRegisteredAgents } from "@/hooks/use-user-registered-agents";
import { useUserVotingStats } from "@/hooks/use-user-voting-stats";
import { useUserPostLikes } from "@/hooks/use-user-post-likes";
import { useUserPostBookmarks } from "@/hooks/use-user-post-bookmarks";
import { useAgents } from "@/hooks/use-agents";
import { useRetireAgent } from "@/hooks/use-retire-agent";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useOwnerDashboard } from "@/hooks/use-owner-dashboard";
import { useOwnerLentAgents } from "@/hooks/use-owner-lent-agents";
import { useOwnerTrades } from "@/hooks/use-owner-trades";
import { AdoptWizard } from "@/components/agent/adopt-wizard";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getAgentAvatarUrl } from "@/lib/avatar";
import { Link } from "@/i18n/navigation";
import { solscanAccountUrl } from "@/lib/solana/explorer";
import { useNetwork } from "@/hooks/use-network";

export default function MePage() {
  const t = useTranslations("me");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const { connected, publicKey, disconnect } = useWallet();
  const { connection } = useConnection();
  const walletAddress = publicKey?.toBase58() ?? null;
  const { sol, loading: balanceLoading, refresh: refreshBalance } = useSolBalance(connection, publicKey ?? null);
  const { network, toggleNetwork } = useNetwork();
  const isAdmin = useIsAdmin();
  const { rentals } = useUserRentals(walletAddress);
  const { agents: registeredAgents, loading: agentsLoading, updateAgent } = useUserRegisteredAgents(walletAddress, isAdmin);
  const { stats } = useUserVotingStats(walletAddress);
  const { retire, loading: retireLoading } = useRetireAgent();
  const { data: dashboardData, loading: dashboardLoading } = useOwnerDashboard(walletAddress);
  const { lentAgents, loading: lentLoading } = useOwnerLentAgents(walletAddress);
  const { positions, trades, loading: tradesLoading } = useOwnerTrades(walletAddress);

  const AGENTS_PER_PAGE = 5;
  const [now] = useState(() => Date.now());
  const [addressCopied, setAddressCopied] = useState(false);
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [apiSheetOpen, setApiSheetOpen] = useState(false);
  const [retiringId, setRetiringId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortField>("return");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [visibleCount, setVisibleCount] = useState(AGENTS_PER_PAGE);
  const { agents } = useAgents();
  const agentsMap = new Map(agents.map((a) => [a.id, a]));
  const { likedPosts } = useUserPostLikes(walletAddress);
  const { bookmarkedPosts } = useUserPostBookmarks(walletAddress);

  const address = publicKey?.toBase58() ?? "";
  const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;

  // Build earnings map from dashboard data for sorting
  const earningsMap = useMemo(() => {
    const map = new Map<string, number>();
    if (dashboardData?.agentBreakdown) {
      for (const ab of dashboardData.agentBreakdown) {
        map.set(ab.agentId, ab.earnings);
      }
    }
    return map;
  }, [dashboardData]);

  // Sort and filter agents
  const sortedFilteredAgents = useMemo(() => {
    let filtered = registeredAgents;

    // Filter: "paused" includes is_paused=true OR is_active=false
    if (filterStatus === "active") {
      filtered = filtered.filter((a) => !a.isPaused && a.isActive);
    } else if (filterStatus === "paused") {
      filtered = filtered.filter((a) => a.isPaused || !a.isActive);
    }

    // Sort
    const sorted = [...filtered];
    switch (sortBy) {
      case "return":
        sorted.sort((a, b) => b.portfolioReturn - a.portfolioReturn);
        break;
      case "accuracy":
        sorted.sort((a, b) => (b.accuracyScore ?? 0) - (a.accuracyScore ?? 0));
        break;
      case "earnings":
        sorted.sort((a, b) => (earningsMap.get(b.id) ?? 0) - (earningsMap.get(a.id) ?? 0));
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  }, [registeredAgents, filterStatus, sortBy, earningsMap]);

  const handleSortChange = useCallback((sort: SortField) => {
    setSortBy(sort);
    setVisibleCount(AGENTS_PER_PAGE);
  }, [AGENTS_PER_PAGE]);

  const handleFilterChange = useCallback((filter: FilterStatus) => {
    setFilterStatus(filter);
    setVisibleCount(AGENTS_PER_PAGE);
  }, [AGENTS_PER_PAGE]);

  const visibleAgents = sortedFilteredAgents.slice(0, visibleCount);
  const hasMore = sortedFilteredAgents.length > visibleCount;
  const remainingCount = sortedFilteredAgents.length - visibleCount;

  function daysLeft(expiresAt: string): number {
    const diff = new Date(expiresAt).getTime() - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  function handleCopyAddress() {
    navigator.clipboard.writeText(address);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  }

  const handleRetire = useCallback(
    async (agentId: string) => {
      if (!walletAddress) return;
      const success = await retire(agentId, walletAddress);
      if (success) {
        setRetiringId(null);
        window.location.reload();
      }
    },
    [walletAddress, retire]
  );

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
                    aria-label={addressCopied ? t("addressCopied") : tCommon("copyAddress")}
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

          <Tabs defaultValue="agents">
            <TabsList variant="line" className="w-full justify-start overflow-x-auto scrollbar-hide">
              <TabsTrigger value="agents" className="flex-none"><Bot className="size-4" /> {t("tabs.agents")}</TabsTrigger>
              <TabsTrigger value="dashboard" className="flex-none"><LayoutDashboard className="size-4" /> {t("tabs.dashboard")}</TabsTrigger>
              <TabsTrigger value="activity" className="flex-none"><Activity className="size-4" /> {t("tabs.activity")}</TabsTrigger>
              <TabsTrigger value="wallet" className="flex-none"><Wallet className="size-4" /> {t("tabs.wallet")}</TabsTrigger>
            </TabsList>

            {/* Tab 0: Agents (default) */}
            <TabsContent value="agents" className="pt-4 pb-20">
              {/* Create Agent + API link */}
              <div className="mb-4">
                <Button
                  onClick={() => setAdoptOpen(true)}
                  className="w-full"
                >
                  <Plus className="size-4" />
                  {t("adoptAgent")}
                </Button>
                <button
                  onClick={() => setApiSheetOpen(true)}
                  className="flex items-center justify-end gap-1 w-full mt-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Code className="size-3" />
                  {t("apiConnect")}
                </button>
              </div>

              {walletAddress && (
                <>
                  <AdoptWizard
                    open={adoptOpen}
                    onOpenChange={setAdoptOpen}
                    walletAddress={walletAddress}
                  />
                  <DeveloperApiSheet
                    open={apiSheetOpen}
                    onOpenChange={setApiSheetOpen}
                  />
                </>
              )}

              {/* My Registered Agents */}

              {/* Sort & Filter */}
              {registeredAgents.length > 0 && (
                <AgentSortFilter
                  sortBy={sortBy}
                  onSortChange={handleSortChange}
                  filterStatus={filterStatus}
                  onFilterChange={handleFilterChange}
                />
              )}

              {agentsLoading ? (
                <div className="space-y-3 mb-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-lg border border-border p-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-8 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-border">
                        {[1, 2, 3, 4].map((j) => (
                          <div key={j} className="flex flex-col items-center gap-1">
                            <Skeleton className="h-4 w-12" />
                            <Skeleton className="h-3 w-10" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : registeredAgents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center mb-6">
                  <Bot className="size-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t("noAgents")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("noAgentsHint")}</p>
                </div>
              ) : (
                <div className="mb-6">
                  {visibleAgents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      walletAddress={walletAddress}
                      isConfirmingRetire={retiringId === agent.id}
                      retireLoading={retireLoading}
                      onRetireClick={() => setRetiringId(agent.id)}
                      onRetireConfirm={() => handleRetire(agent.id)}
                      onRetireCancel={() => setRetiringId(null)}
                      onLiveTradingToggle={(id, enabled) => updateAgent(id, { liveTradingEnabled: enabled })}
                      onPauseToggle={(id, paused) => updateAgent(id, { isPaused: paused })}
                      onConfigUpdated={() => window.location.reload()}
                    />
                  ))}
                  {hasMore && (
                    <button
                      onClick={() => setVisibleCount((c) => c + AGENTS_PER_PAGE)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg border border-dashed border-border hover:border-primary/30"
                    >
                      <ChevronDown className="size-4" />
                      {t("showMore", { count: remainingCount })}
                    </button>
                  )}
                </div>
              )}

              {/* Rented Agents */}
              <h2 className="text-lg font-semibold mb-3">{t("rentedAgents")}</h2>
              {rentals.length === 0 ? (
                <p className="text-sm text-muted-foreground mb-6">{t("noRentals")}</p>
              ) : (
                <div className="divide-y divide-border mb-6">
                  {rentals.map((rental) => {
                    const agentData = agentsMap.get(rental.agentId);
                    return (
                      <Link
                        key={rental.id}
                        href={`/agent/${rental.agentId}`}
                        className="py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors -mx-1 px-1 rounded"
                      >
                        <Avatar size="sm">
                          <AvatarImage
                            src={getAgentAvatarUrl(agentData?.name ?? rental.agentName)}
                            alt={rental.agentName}
                          />
                          <AvatarFallback><Bot className="size-4" /></AvatarFallback>
                        </Avatar>
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
                      </Link>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Tab 1: Dashboard */}
            <TabsContent value="dashboard" className="pt-4 pb-20">
              <DashboardSummary
                dashboardData={dashboardData}
                registeredAgents={registeredAgents}
                positions={positions}
                trades={trades}
                lentAgents={lentAgents}
                loading={dashboardLoading}
                tradesLoading={tradesLoading}
                lentLoading={lentLoading}
                walletAddress={walletAddress!}
                onAgentUpdated={() => window.location.reload()}
              />
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

            {/* Tab 2: Wallet */}
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
                      aria-label={addressCopied ? t("addressCopied") : tCommon("copyAddress")}
                    >
                      {addressCopied ? (
                        <Check className="size-3.5 text-bullish" />
                      ) : (
                        <Copy className="size-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Network Toggle */}
                <div className="p-4 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{t("network")}</p>
                  <button
                    onClick={toggleNetwork}
                    className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <span className={`size-2 rounded-full ${network === "mainnet-beta" ? "bg-bullish" : "bg-amber-400"}`} />
                    {network === "mainnet-beta" ? t("networkMainnet") : t("networkDevnet")}
                  </button>
                </div>

                {/* Explorer Link */}
                <div className="p-4">
                  <a
                    href={solscanAccountUrl(address)}
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
          </Tabs>
        </>
      )}
    </AppShell>
  );
}
