"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/app-shell";
import { AgentCard } from "@/components/agent/agent-card";
import { ContestCard } from "@/components/prediction/contest-card";
import { PredictionMarketList } from "@/components/prediction/prediction-market-list";
import { PeriodSelector } from "@/components/prediction/period-selector";
import { ContestResult } from "@/components/prediction/contest-result";
import { PositionSheet } from "@/components/prediction/position-sheet";
import { ExactOrderSheet } from "@/components/prediction/exact-order-sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  agents as mockAgents,
  predictionContest,
  previousContest,
  getPredictionMarkets,
} from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import { dbAgentToAgent } from "@/lib/supabase/mappers";
import type { DbAgent } from "@/lib/supabase/mappers";
import type { Agent } from "@/lib/types";

export default function PredictionPage() {
  const tPrediction = useTranslations("prediction");
  const tAgents = useTranslations("agents");
  const tPosition = useTranslations("position");

  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [positionSheetOpen, setPositionSheetOpen] = useState(false);
  const [exactOrderSheetOpen, setExactOrderSheetOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>(mockAgents);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("agents")
      .select("*")
      .order("leaderboard_rank", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setAgents((data as DbAgent[]).map(dbAgentToAgent));
        }
      });
  }, []);

  const sortedAgents = [...agents].sort((a, b) => a.rank - b.rank);
  const activeMarkets = getPredictionMarkets();

  const topAgent = sortedAgents[0];
  const topEntry = predictionContest.entries.find((e) => e.agentId === topAgent.id) ?? predictionContest.entries[0];

  return (
    <AppShell>
      <Tabs defaultValue="contest">
        <TabsList>
          <TabsTrigger value="contest">{tPrediction("contestTab")}</TabsTrigger>
          <TabsTrigger value="markets">{tPrediction("marketsTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="contest" className="space-y-4">
          <PeriodSelector value={period} onChange={setPeriod} />

          <ContestCard
            contest={predictionContest}
            agents={agents}
            labels={{
              contest: tPrediction("contest"),
              firstPlace: tPrediction("firstPlace"),
              topThree: tPrediction("topThree"),
            }}
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setPositionSheetOpen(true)}
            >
              {tPosition("singleBet")}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setExactOrderSheetOpen(true)}
            >
              {tPosition("topThreeBet")}
            </Button>
          </div>

          <ContestResult contest={previousContest} agents={agents} />

          <h2 className="text-lg font-semibold">{tAgents("leaderboard")}</h2>
          <div className="space-y-2">
            {sortedAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="markets">
          <PredictionMarketList markets={activeMarkets} agents={agents} />
        </TabsContent>
      </Tabs>

      <PositionSheet
        open={positionSheetOpen}
        onOpenChange={setPositionSheetOpen}
        agent={topAgent}
        entry={topEntry}
        betType="single"
      />

      <ExactOrderSheet
        open={exactOrderSheetOpen}
        onOpenChange={setExactOrderSheetOpen}
        agents={agents}
      />
    </AppShell>
  );
}
