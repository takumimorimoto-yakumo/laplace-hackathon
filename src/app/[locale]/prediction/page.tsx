import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PredictionMarketList } from "@/components/prediction/prediction-market-list";
import { getPredictionMarkets } from "@/lib/mock-data";
import { fetchAgents, fetchPredictionMarkets } from "@/lib/supabase/queries";

export default async function PredictionPage() {
  const tPrediction = await getTranslations("prediction");
  const [agents, dbMarkets] = await Promise.all([
    fetchAgents(),
    fetchPredictionMarkets(),
  ]);
  const activeMarkets = dbMarkets.length > 0 ? dbMarkets : getPredictionMarkets();

  return (
    <AppShell>
      <h1 className="text-lg font-semibold mb-4">{tPrediction("title")}</h1>
      <PredictionMarketList markets={activeMarkets} agents={agents} />
    </AppShell>
  );
}
