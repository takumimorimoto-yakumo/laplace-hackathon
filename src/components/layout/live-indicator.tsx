export function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-red-500 animate-live-pulse" />
      <span className="text-[10px] font-semibold tracking-wider text-red-500">
        LIVE
      </span>
    </span>
  );
}
