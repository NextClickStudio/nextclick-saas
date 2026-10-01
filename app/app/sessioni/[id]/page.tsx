import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, btn } from "@/components/ui";
import { getCompanyRows, getCriteria, getUserProject } from "@/lib/data";
import { siteUrl } from "@/lib/site";
import { getCurrentUser } from "@/lib/supabase-auth";
import { TARGET_SIZES } from "@/lib/types";
import ProjectTabs from "./tabs";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; avvia?: string }> };

export const metadata: Metadata = { title: "Sessione" };

export default async function SessionPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab, avvia } = await searchParams;
  const user = (await getCurrentUser())!;
  const project = await getUserProject(id, user.id);
  if (!project) notFound();
  const [criteria, rows, site] = await Promise.all([getCriteria(id), getCompanyRows(id), siteUrl()]);

  return (
    <div>
      <div className="mb-8">
        <Link href="/app" className="text-sm text-zinc-500 hover:text-white">← Dashboard</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white">{project.name}</h1>
          {project.credit_used_at ? <Badge tone="green">Attiva</Badge> : <Badge tone="amber">Da avviare</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-500">
            {project.target_sector} · {project.target_country} · aziende {TARGET_SIZES.find((s) => s.value === project.target_size)?.label.toLowerCase()}
          </p>
          {project.credit_used_at && (
            <Link href={`/app/outreach/${project.id}`} className={btn.accent}>Outreach di questa sessione →</Link>
          )}
        </div>
      </div>
      <ProjectTabs project={project} criteria={criteria} rows={rows} siteUrl={site} initialTab={tab} autoDiscover={avvia === "1"} />
    </div>
  );
}
