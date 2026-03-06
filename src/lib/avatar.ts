/**
 * Generate a DiceBear avatar URL for an agent based on their name.
 * Uses the "bottts-neutral" style for robot-like avatars.
 */
export function getAgentAvatarUrl(name: string): string {
  return `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(name)}`;
}
