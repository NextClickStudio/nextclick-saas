// Esporta la classifica del progetto in CSV (si apre con Excel / Google Sheets).
import { handle, uuid } from "@/lib/api";
import { getCompanyRows, getCriteria, getUserProject } from "@/lib/data";
import { requireUser } from "@/lib/supabase-auth";
import { UserError } from "@/lib/db";
import { statusLabel } from "@/lib/types";

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  // protezione da "formule" nei fogli di calcolo e virgolette
  const safe = /^[=+\-@]/.test(s) ? "'" + s : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const projectId = uuid.parse(new URL(request.url).searchParams.get("projectId"));
    const project = await getUserProject(projectId, user.id);
    if (!project) throw new UserError("Sessione non trovata.");
    const [criteria, rows] = await Promise.all([getCriteria(projectId), getCompanyRows(projectId)]);
    const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

    const header = ["posizione", "azienda", "sito", "punteggio", ...criteria.map((c) => c.name), "canale consigliato", "stato", "visite report", "link report", "note"];
    const sorted = [...rows].sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999));
    const lines = sorted.map((r) => [
      r.position ?? "",
      r.name,
      r.website_url,
      r.analysis?.total_score ?? "",
      ...criteria.map((c) => r.analysis?.scores?.find((s) => s.criterion_id === c.id)?.score ?? ""),
      r.contact_plan?.channel_label ?? "",
      statusLabel(r.status),
      r.report?.view_count ?? 0,
      r.report ? `${site}/r/${r.report.slug}` : "",
      r.notes ?? "",
    ]);
    const csv = "﻿" + [header, ...lines].map((l) => l.map(csvCell).join(",")).join("\r\n");
    const filename = `classifica-${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.csv`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  });
}
