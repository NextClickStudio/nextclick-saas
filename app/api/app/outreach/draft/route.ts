// Genera (o rigenera) i messaggi personalizzati di un'azienda per il passo indicato.
import { z } from "zod";
import { generateOutreach } from "@/lib/ai";
import { handle, ownedCompany, readBody, uuid } from "@/lib/api";
import { SITE_URL } from "@/lib/config";
import { getCompanyRows, getUserProject } from "@/lib/data";
import { db, UserError } from "@/lib/db";
import { MAX_REGENERATIONS, MAX_STEP, sendChannelsFor } from "@/lib/outreach";
import { getAccount, requireUser } from "@/lib/supabase-auth";
import { consumeAiQuota } from "@/lib/quota";

export const maxDuration = 60;

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { companyId, step, reply } = await readBody(
      request,
      z.object({ companyId: uuid, step: z.number().int().min(0).max(MAX_STEP), reply: z.string().max(2000).optional() }),
    );
    const company = await ownedCompany(companyId, user.id);
    const account = await getAccount(user.id);

    // Il primo messaggio di ogni passo è libero; poi al massimo 2 riscritture.
    // Se arriva una nuova risposta del cliente è un messaggio nuovo, non una riscrittura.
    const { data: stored } = await db().from("companies").select("drafts").eq("id", companyId).single();
    const existing = ((stored?.drafts ?? {}) as Record<string, { regenerations?: number; reply?: string }>)[String(step)];
    const sameRequest = Boolean(existing) && (existing?.reply ?? "") === (reply?.trim() ?? "");
    const regenerations = sameRequest ? (existing?.regenerations ?? 0) + 1 : 0;
    if (regenerations > MAX_REGENERATIONS && !account.unlimited) {
      throw new UserError(`Hai già fatto riscrivere questo messaggio ${MAX_REGENERATIONS} volte: modificalo a mano qui sotto.`);
    }
    await consumeAiQuota(user.id, "draft");
    const project = (await getUserProject(company.project_id, user.id))!;
    const rows = await getCompanyRows(project.id);
    const row = rows.find((r) => r.id === companyId);
    if (!row?.analysis || !row.report) throw new UserError("Analizza prima l'azienda: il messaggio si basa sul suo report.");

    const { data: previous } = await db().from("messages").select("body").eq("company_id", companyId).order("sent_at");
    const channels = sendChannelsFor(row.contact_channels, row.contact_plan?.channel_type);
    // a chi arriva il messaggio: il primo canale di quel tipo (le persone chiave sono messe prima del brand)
    const recipients: Record<string, { name: string; role: string } | undefined> = {};
    for (const ch of channels) {
      const c = (row.contact_channels ?? []).find((x) => x.type === ch);
      if (c?.person) recipients[ch] = { name: c.person, role: c.role ?? "" };
    }

    const drafts = await generateOutreach({
      companyName: row.name,
      sector: project.target_sector,
      productDescription: project.product_description,
      senderName: account.full_name ?? project.sender_name ?? "",
      senderCompany: account.company_name ?? "",
      senderRole: account.sender_role ?? "",
      senderWebsite: account.company_website ?? "",
      senderOffer: account.company_offer ?? "",
      bookingUrl: account.booking_url ?? project.report_cta_url ?? "",
      reportUrl: `${SITE_URL}/r/${row.report.slug}`,
      position: row.position,
      total: rows.filter((r) => r.analysis).length,
      score: Number(row.analysis.total_score ?? 0),
      weakPoints: (row.analysis.weak_points ?? []).map((w) => ({ title: w.title, explanation: w.explanation })),
      openingAngle: row.contact_plan?.opening_angle ?? "",
      channels,
      recipients,
      step,
      previous: (previous ?? []).map((m) => m.body as string),
      reply,
    });

    const all = (stored?.drafts ?? {}) as Record<string, unknown>;
    all[String(step)] = { generated_at: new Date().toISOString(), messages: drafts, regenerations, reply: reply?.trim() ?? "" };
    const { error } = await db().from("companies").update({ drafts: all }).eq("id", companyId);
    if (error) throw error;
    return { messages: drafts, regenerationsLeft: account.unlimited ? null : Math.max(0, MAX_REGENERATIONS - regenerations) };
  });
}
