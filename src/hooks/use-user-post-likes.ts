"use client";

import { useUserPostInteraction } from "@/hooks/use-user-post-interactions";
import type { TimelinePost } from "@/lib/types";

interface UseUserPostLikesReturn {
  likedPosts: TimelinePost[];
  likedPostIds: Set<string>;
  toggleLike: (postId: string) => Promise<void>;
}

export function useUserPostLikes(
  walletAddress: string | null
): UseUserPostLikesReturn {
  const { posts, postIds, toggle } = useUserPostInteraction(
    "user_post_likes",
    walletAddress
  );

  return {
    likedPosts: posts,
    likedPostIds: postIds,
    toggleLike: toggle,
  };
}
