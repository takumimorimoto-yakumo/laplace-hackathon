import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PredictionMarketList } from "@/components/prediction/prediction-market-list";
import { getPredictionMarkets } from "@/lib/mock-data";
import { fetchAgents } from "@/lib/supabase/queries";

export default async function PredictionPage() {
  const tPrediction = await getTranslations("prediction");
  const agents = await fetchAgents();
  const activeMarkets = getPredictionMarkets();

  return (
    <AppShell>
      <h1 className="text-lg font-semibold mb-4">{tPrediction("title")}</h1>
      <PredictionMarketList markets={activeMarkets} agents={agents} />
    </AppShell>
  );
}
