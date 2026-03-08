import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PredictionMarketTabs } from "@/components/prediction/prediction-market-tabs";
import { fetchAgents, fetchPredictionMarkets } from "@/lib/supabase/queries";

export default async function PredictionPage() {
  const tPrediction = await getTranslations("prediction");
  const [agents, activeMarkets, resolvedMarkets] = await Promise.all([
    fetchAgents(),
    fetchPredictionMarkets(),
    fetchPredictionMarkets({ resolved: true }),
  ]);

  return (
    <AppShell>
      <h1 className="text-lg font-semibold mb-4">{tPrediction("title")}</h1>
      <PredictionMarketTabs
        activeMarkets={activeMarkets}
        resolvedMarkets={resolvedMarkets}
        agents={agents}
      />
    </AppShell>
  );
}
