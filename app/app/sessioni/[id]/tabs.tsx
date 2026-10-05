"use client";

import { useState } from "react";
import type { CompanyRow, Criterion, Project } from "@/lib/types";
import CompaniesTab from "./companies-tab";
import AnalysisTab from "./analysis-tab";
import RankingTab from "./ranking-tab";
import ContactsTab from "./contacts-tab";
import PublishTab from "./publish-tab";
import SettingsTab from "./settings-tab";

const TABS = [
  { id: "aziende", label: "Aziende" },
  { id: "analisi", label: "Analisi" },
  { id: "classifica", label: "Classifica" },
  { id: "contatti", label: "Contatti" },
  { id: "pubblicazione", label: "Pubblicazione" },
  { id: "impostazioni", label: "Impostazioni" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export type TabProps = { project: Project; criteria: Criterion[]; rows: CompanyRow[]; siteUrl: string; pro: boolean };

export default function ProjectTabs(props: TabProps & { initialTab?: string; autoDiscover?: boolean }) {
  const [tab, setTab] = useState<TabId>(TABS.some((t) => t.id === props.initialTab) ? (props.initialTab as TabId) : "aziende");

  function select(id: TabId) {
    setTab(id);
    // ricorda la tab nell'URL (utile se ricarichi la pagina)
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    url.searchParams.delete("avvia");
    window.history.replaceState(null, "", url);
  }

  const analyzed = props.rows.filter((r) => r.analysis).length;

  return (
    <div>
      <div className="mb-8 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => select(t.id)}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
                tab === t.id ? "bg-white text-ink shadow" : "text-zinc-400 hover:text-white"
              }`}
            >
              {t.label}
              {t.id === "aziende" && props.rows.length > 0 && <span className="ml-1.5 text-xs opacity-60">{props.rows.length}</span>}
              {t.id === "contatti" && analyzed > 0 && <span className="ml-1.5 text-xs opacity-60">{analyzed}</span>}
            </button>
          ))}
        </div>
      </div>
      {tab === "aziende" && <CompaniesTab {...props} autoDiscover={props.autoDiscover} goTo={select} />}
      {tab === "analisi" && <AnalysisTab {...props} />}
      {tab === "classifica" && <RankingTab {...props} />}
      {tab === "contatti" && <ContactsTab {...props} />}
      {tab === "pubblicazione" && <PublishTab {...props} />}
      {tab === "impostazioni" && <SettingsTab key={props.criteria.map((c) => c.id).join()} {...props} />}
    </div>
  );
}
