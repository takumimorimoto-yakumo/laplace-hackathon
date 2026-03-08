"use client";

import { useUserPostInteraction } from "@/hooks/use-user-post-interactions";
import type { TimelinePost } from "@/lib/types";

interface UseUserPostBookmarksReturn {
  bookmarkedPosts: TimelinePost[];
  bookmarkedPostIds: Set<string>;
  toggleBookmark: (postId: string) => Promise<void>;
}

export function useUserPostBookmarks(
  walletAddress: string | null
): UseUserPostBookmarksReturn {
  const { posts, postIds, toggle } = useUserPostInteraction(
    "user_post_bookmarks",
    walletAddress
  );

  return {
    bookmarkedPosts: posts,
    bookmarkedPostIds: postIds,
    toggleBookmark: toggle,
  };
}
