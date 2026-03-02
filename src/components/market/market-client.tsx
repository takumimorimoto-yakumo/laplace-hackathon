"use client";

import { useState, useMemo } from "react";
import { SearchBar } from "@/components/market/search-bar";
import { CategoryTabs } from "@/components/market/category-tabs";
import { MarketTokenRow } from "@/components/market/market-token-row";
import type { MarketToken } from "@/lib/types";

const PAGE_SIZE = 20;

interface MarketClientProps {
  tokens: MarketToken[];
}

export function MarketClient({ tokens }: MarketClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filteredTokens = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return tokens.filter((token) => {
      const matchesSearch =
        query === "" ||
        token.name.toLowerCase().includes(query) ||
        token.symbol.toLowerCase().includes(query);

      const matchesCategory =
        activeCategory === "All" ||
        (token.tags ?? []).some(
          (tag) => tag.toLowerCase() === activeCategory.toLowerCase()
        );

      return matchesSearch && matchesCategory;
    });
  }, [tokens, searchQuery, activeCategory]);

  // Reset visible count when filter changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setVisibleCount(PAGE_SIZE);
  };

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setVisibleCount(PAGE_SIZE);
  };

  const visibleTokens = filteredTokens.slice(0, visibleCount);
  const hasMore = visibleCount < filteredTokens.length;

  return (
    <div>
      <div className="flex flex-col gap-3">
        <SearchBar
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search tokens..."
        />
        <CategoryTabs
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
        />
      </div>

      <div className="mt-4 rounded-lg border border-border overflow-hidden">
        {visibleTokens.map((token) => (
          <MarketTokenRow key={token.address} token={token} />
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="mt-3 w-full rounded-lg border border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Load more ({filteredTokens.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
}
