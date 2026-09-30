"use client";

import { useState } from "react";
import type { CompanyRow, Criterion, Project } from "@/lib/types";
import CompaniesTab from "./companies-tab";
import AnalysisTab from "./analysis-tab";
import RankingTab from "./ranking-tab";
import PublishTab from "./publish-tab";
import SettingsTab from "./settings-tab";

const TABS = [
  { id: "aziende", label: "Aziende" },
  { id: "analisi", label: "Analisi" },
  { id: "classifica", label: "Classifica" },
  { id: "pubblicazione", label: "Pubblicazione" },
  { id: "impostazioni", label: "Impostazioni" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export type TabProps = { project: Project; criteria: Criterion[]; rows: CompanyRow[]; siteUrl: string };

export default function ProjectTabs(props: TabProps & { initialTab?: string }) {
  const [tab, setTab] = useState<TabId>(
    TABS.some((t) => t.id === props.initialTab) ? (props.initialTab as TabId) : "aziende",
  );

  function select(id: TabId) {
    setTab(id);
    // ricorda la tab nell'URL (utile se ricarichi la pagina)
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url);
  }

  return (
    <div>
      <div className="mb-6 -mx-4 overflow-x-auto border-b border-gray-200 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => select(t.id)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.id ? "border-accent text-accent" : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "aziende" && <CompaniesTab {...props} />}
      {tab === "analisi" && <AnalysisTab {...props} />}
      {tab === "classifica" && <RankingTab {...props} />}
      {tab === "pubblicazione" && <PublishTab {...props} />}
      {tab === "impostazioni" && <SettingsTab key={props.criteria.map((c) => c.id).join()} {...props} />}
    </div>
  );
}
