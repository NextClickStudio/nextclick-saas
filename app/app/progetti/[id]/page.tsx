import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanyRows, getCriteria, getProject } from "@/lib/data";
import { siteUrl } from "@/lib/site";
import ProjectTabs from "./tabs";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getProject((await params).id);
  return { title: project?.name ?? "Progetto" };
}

export default async function ProjectPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;
  const project = await getProject(id);
  if (!project) notFound();
  const [criteria, rows, site] = await Promise.all([getCriteria(id), getCompanyRows(id), siteUrl()]);

  return (
    <div>
      <div className="mb-6">
        <Link href="/app" className="text-sm text-gray-500 hover:text-gray-900">
          ← Progetti
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{project.name}</h1>
        <p className="text-sm text-gray-600">{project.target_sector}</p>
      </div>
      <ProjectTabs project={project} criteria={criteria} rows={rows} siteUrl={site} initialTab={tab} />
    </div>
  );
}
