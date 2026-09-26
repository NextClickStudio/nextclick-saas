/** Shown for the split second before the first data arrives. */
export function Splash() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-bg">
      <span className="grid h-16 w-16 animate-pulse place-items-center rounded-[20px] bg-ivory text-3xl font-black text-bg">M</span>
    </div>
  );
}
