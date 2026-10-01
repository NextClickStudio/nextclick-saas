"use client";

// Barra di avanzamento in alto mentre si cambia pagina: feedback immediato al clic.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function NavProgress() {
  const pathname = usePathname();
  // percorso da cui è partito il clic: quando il percorso cambia, la barra sparisce da sola
  const [from, setFrom] = useState<string | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      const start = window.location.pathname;
      setFrom(start);
      setTimeout(() => setFrom((f) => (f === start ? null : f)), 8000); // sicurezza
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const loading = from !== null && from === pathname;
  return (
    <div className={`pointer-events-none fixed inset-x-0 top-0 z-[200] h-0.5 transition-opacity duration-300 ${loading ? "opacity-100" : "opacity-0"}`}>
      <div className={`h-full bg-gradient-to-r from-accent via-[#a99bff] to-cyan shadow-[0_0_12px_rgba(139,123,255,0.9)] ${loading ? "nav-progress" : "w-full"}`} />
    </div>
  );
}
