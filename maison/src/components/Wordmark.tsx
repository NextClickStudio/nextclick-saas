/** Maison wordmark: a small monogram tile + lowercase heavy name. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-ivory text-[15px] font-black text-bg">M</span>
      <span className="headline text-[28px]">maison</span>
    </div>
  );
}
