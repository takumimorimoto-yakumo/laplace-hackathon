import { AppShell } from "@/components/layout/app-shell";
import { PredictionMarketTabs } from "@/components/prediction/prediction-market-tabs";
import { fetchAgents, fetchPredictionMarkets } from "@/lib/supabase/queries";

export default async function PredictionPage() {
  const [agents, activeMarkets, resolvedMarkets] = await Promise.all([
    fetchAgents(),
    fetchPredictionMarkets(),
    fetchPredictionMarkets({ resolved: true }),
  ]);

  return (
    <AppShell>
      <PredictionMarketTabs
        activeMarkets={activeMarkets}
        resolvedMarkets={resolvedMarkets}
        agents={agents}
      />
    </AppShell>
  );
}
