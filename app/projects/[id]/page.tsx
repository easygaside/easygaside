import { notFound, redirect } from "next/navigation";
import { IdeShell } from "@/components/ide/IdeShell";
import { getFiles } from "@/lib/files";
import { getCurrentUserId, getProject } from "@/lib/projects";

export default async function ProjectBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const { id } = await params;
  const project = await getProject(id); // RLS-scoped → null if not owned
  if (!project) notFound();

  // ownership verified above → safe to read files via service-role
  const files = await getFiles(id);

  // honest hint when the project asked for a capability GAS can't serve yet (web target)
  const spec = (project.spec ?? {}) as { webOnlyReasons?: unknown };
  const webHint =
    Array.isArray(spec.webOnlyReasons) && spec.webOnlyReasons.length > 0
      ? (spec.webOnlyReasons as string[])
      : undefined;

  return (
    <IdeShell
      projectId={id}
      projectName={project.name}
      initialFiles={files.map((f) => ({ path: f.path, content: f.content }))}
      webHint={webHint}
    />
  );
}
