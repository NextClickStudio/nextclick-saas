import type { ReactNode } from "react";
import { Footer } from "./Home";
import TopBar from "./TopBar";

export default function Doc({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <TopBar />
      <main className="page wrap">
        <div className="page-head">
          <span className="h-eyebrow">Legal</span>
          <h1 className="disp">{title}</h1>
        </div>
        <article className="doc">
          <p className="upd">Last updated {updated}</p>
          {children}
        </article>
      </main>
      <Footer />
    </>
  );
}
