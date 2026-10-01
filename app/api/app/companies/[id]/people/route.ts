// Cerca su Google le persone chiave di un'azienda (founder, marketing, commerciale) e le aggiunge ai suoi contatti.
import { findPeopleOnWeb } from "@/lib/ai";
import { handle, ownedCompany, uuid } from "@/lib/api";
import { getUserProject } from "@/lib/data";
import { db, UserError } from "@/lib/db";
import { mergeWebPeople, webPeopleAsHints } from "@/lib/people";
import { requireUser } from "@/lib/supabase-auth";
import type { ContactChannel } from "@/lib/crawler";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const company = await ownedCompany(uuid.parse((await params).id), user.id);
    const project = await getUserProject(company.project_id, user.id);
    if (!project?.credit_used_at) throw new UserError("Avvia prima la sessione.");

    const found = await findPeopleOnWeb({ companyName: company.name, website: company.website_url, sector: project.target_sector });
    // Instagram verificato (il nome deve comparire nel profilo), poi si uniscono ai contatti esistenti
    const { profiles } = await webPeopleAsHints(found);
    const ig = new Set(profiles.filter((p) => p.network === "instagram").map((p) => p.url));
    const people = found.map((p) => ({ ...p, instagram_url: ig.has(p.instagram_url.replace(/\/$/, "")) ? p.instagram_url : "" }));

    const channels = mergeWebPeople(company.name, (company.contact_channels as ContactChannel[] | null) ?? [], people);
    const { error } = await db().from("companies").update({ contact_channels: channels }).eq("id", company.id);
    if (error) throw error;
    return { found: people.length };
  });
}
