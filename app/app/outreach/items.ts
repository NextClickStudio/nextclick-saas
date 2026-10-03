// Aziende pronte per l'outreach di una sessione (lato server).
import "server-only";
import { SITE_URL } from "@/lib/config";
import { getCompanyRows } from "@/lib/data";
import type { OutreachItem } from "@/lib/outreach";
import type { Project } from "@/lib/types";

function isDue(iso: string | null): boolean {
  return Boolean(iso) && new Date(iso!).getTime() <= Date.now();
}

export async function outreachItems(project: Project): Promise<OutreachItem[]> {
  if (!project.credit_used_at) return [];
  const rows = await getCompanyRows(project.id);
  const analyzed = rows.filter((r) => r.analysis).length;
  return rows
    .filter((r) => r.analysis && r.report)
    .map((r) => ({
      id: r.id,
      name: r.name,
      website: r.website_url,
      sessionId: project.id,
      sessionName: project.name,
      score: Number(r.analysis!.total_score ?? 0),
      position: r.position,
      total: analyzed,
      status: r.status,
      channels: r.contact_channels,
      plan: r.contact_plan,
      reportUrl: `${SITE_URL}/r/${r.report!.slug}`,
      views: r.report!.view_count,
      lastViewedAt: r.report!.last_viewed_at,
      step: r.followup_step,
      nextFollowupAt: r.next_followup_at,
      lastContactedAt: r.last_contacted_at,
      drafts: r.drafts,
      due: isDue(r.next_followup_at),
    }));
}
