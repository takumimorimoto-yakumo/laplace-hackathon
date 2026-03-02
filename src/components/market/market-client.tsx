"use client";

import { useState } from "react";
import { SearchBar } from "@/components/market/search-bar";
import { CategoryTabs } from "@/components/market/category-tabs";
import { MarketTokenRow } from "@/components/market/market-token-row";
import type { MarketToken } from "@/lib/types";

interface MarketClientProps {
  tokens: MarketToken[];
}

export function MarketClient({ tokens }: MarketClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredTokens = tokens.filter((token) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      query === "" ||
      token.name.toLowerCase().includes(query) ||
      token.symbol.toLowerCase().includes(query);

    const matchesCategory =
      activeCategory === "All" ||
      (token.tags ?? []).some((tag) => tag.toLowerCase() === activeCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search tokens..."
        />
        <CategoryTabs
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />
      </div>

      <div className="mt-4 rounded-lg border border-border overflow-hidden">
        {filteredTokens.map((token) => (
          <MarketTokenRow key={token.address} token={token} />
        ))}
      </div>
    </div>
  );
}
