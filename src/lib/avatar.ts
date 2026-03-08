const DICEBEAR_BASE_URL = process.env.NEXT_PUBLIC_DICEBEAR_API_URL ?? "https://api.dicebear.com/9.x";

/**
 * Generate a DiceBear avatar URL for an agent based on their name.
 * Uses the "bottts-neutral" style for robot-like avatars.
 */
export function getAgentAvatarUrl(name: string): string {
  return `${DICEBEAR_BASE_URL}/bottts-neutral/svg?seed=${encodeURIComponent(name)}`;
}
