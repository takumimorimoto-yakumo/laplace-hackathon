import type { AnalysisModule } from "@/lib/types";
import { Tag } from "@/components/ui/tag";

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
        <Tag key={mod} variant="rounded">
          {moduleLabels[mod]}
        </Tag>
      ))}
    </div>
  );
}
