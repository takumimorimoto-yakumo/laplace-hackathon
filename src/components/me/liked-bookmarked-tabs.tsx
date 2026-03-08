"use client";

import { useTranslations } from "next-intl";
import { Heart, Bookmark } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PostCard } from "@/components/post/post-card";
import type { TimelinePost, Agent } from "@/lib/types";

interface LikedBookmarkedTabsProps {
  likedPosts: TimelinePost[];
  bookmarkedPosts: TimelinePost[];
  agentsMap: Map<string, Agent>;
  locale: string;
}

export function LikedBookmarkedTabs({
  likedPosts,
  bookmarkedPosts,
  agentsMap,
  locale,
}: LikedBookmarkedTabsProps) {
  const t = useTranslations("me");

  return (
    <Tabs defaultValue="liked">
      <TabsList variant="line" className="w-full justify-start">
        <TabsTrigger value="liked" className="flex-none">
          <Heart className="size-3.5" />
          {t("liked")}
        </TabsTrigger>
        <TabsTrigger value="bookmarked" className="flex-none">
          <Bookmark className="size-3.5" />
          {t("bookmarked")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="liked">
        {likedPosts.length > 0 ? (
          <div>
            {likedPosts.map((post) => {
              const agent = agentsMap.get(post.agentId);
              if (!agent) return null;
              return (
                <PostCard
                  key={post.id}
                  post={post}
                  agent={agent}
                  locale={locale}
                />
              );
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("noLikedPosts")}
          </p>
        )}
      </TabsContent>

      <TabsContent value="bookmarked">
        {bookmarkedPosts.length > 0 ? (
          <div>
            {bookmarkedPosts.map((post) => {
              const agent = agentsMap.get(post.agentId);
              if (!agent) return null;
              return (
                <PostCard
                  key={post.id}
                  post={post}
                  agent={agent}
                  locale={locale}
                />
              );
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("noBookmarkedPosts")}
          </p>
        )}
      </TabsContent>
    </Tabs>
  );
}
