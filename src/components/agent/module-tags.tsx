import type { AnalysisModule } from "@/lib/types";

interface ModuleTagsProps {
  modules: AnalysisModule[];
}

const moduleLabels: Record<AnalysisModule, string> = {
  onchain: "OnChain",
  technical: "Technical",
  sentiment: "Sentiment",
  defi: "DeFi",
  macro_regulatory: "Macro",
  risk: "Risk",
  news: "News",
  cross_chain: "CrossChain",
};

export function ModuleTags({ modules }: ModuleTagsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {modules.map((mod) => (
        <span
          key={mod}
          className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
        >
          {moduleLabels[mod]}
        </span>
      ))}
    </div>
  );
}
