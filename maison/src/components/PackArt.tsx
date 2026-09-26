/** The daily pack wrapper: dark foil, monogram, a tear line near the top. */
export function PackArt({ label = "Daily pack", date }: { label?: string; date?: string }) {
  return (
    <div className="@container relative aspect-[5/8] w-full overflow-hidden rounded-[28px] bg-[linear-gradient(160deg,#2a2826,#121110_55%,#262320)] shadow-[0_30px_60px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
      {/* foil sheen */}
      <div className="shimmer absolute inset-0" />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "radial-gradient(circle at center, #f2eee6 1.1px, transparent 1.3px)", backgroundSize: "12px 12px" }}
      />
      {/* tear line */}
      <div className="absolute top-[15%] right-[6%] left-[6%] border-t-2 border-dashed border-white/20" />
      <div className="relative flex h-full flex-col items-center justify-center gap-[5cqw]">
        <span className="grid h-[30cqw] w-[30cqw] place-items-center rounded-[8cqw] bg-ivory text-[17cqw] font-black text-bg">M</span>
        <span className="text-[11cqw] font-extrabold tracking-[-0.04em]">maison</span>
        <span className="font-mono text-[3.8cqw] tracking-[0.3em] text-muted uppercase">{label}</span>
      </div>
      {date && <span className="absolute right-0 bottom-[6cqw] left-0 text-center font-mono text-[3.4cqw] tracking-[0.2em] text-muted">{date}</span>}
    </div>
  );
}
