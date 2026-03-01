interface ProbabilityBadgeProps {
  probability: number;
}

export function ProbabilityBadge({ probability }: ProbabilityBadgeProps) {
  return (
    <span className="text-xs font-mono font-medium text-primary">
      {probability}%
    </span>
  );
}
