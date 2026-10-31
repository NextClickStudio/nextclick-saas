import type { ReactNode } from "react";
import Nav, { Footer } from "./Nav";

export default function Doc({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <Nav />
      <main className="page wrap">
        <div className="page-head">
          <span className="label">Legal</span>
          <h1>{title}</h1>
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
