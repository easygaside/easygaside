import { notFound, redirect } from "next/navigation";
import { IdeShell } from "@/components/ide/IdeShell";
import { getAccessGate } from "@/lib/beta";
import { listProjectChatImages } from "@/lib/chat-images";
import { ENERGY_TANK, getProjectEnergyUsed } from "@/lib/energy";
import { getFiles } from "@/lib/files";
import { getConnectionStatus } from "@/lib/google-connection";
import { getCurrentUser, getDeployedUrl, getProject } from "@/lib/projects";

export default async function ProjectBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const userId = user.id;
  const gate = await getAccessGate(userId, user.email);
  if (!gate.allowed) redirect("/waitlist");

  const { id } = await params;
  const project = await getProject(id); // RLS-scoped → null if not owned
  if (!project) notFound();

  // ownership verified above → safe to read files / images via service-role
  const [files, conn, chatImages, energyUsed, deployedUrl] = await Promise.all([
    getFiles(id),
    getConnectionStatus(userId),
    listProjectChatImages(id),
    getProjectEnergyUsed(id),
    getDeployedUrl(id),
  ]);

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
      initialImages={chatImages.map((img) => ({ url: img.url }))}
      webHint={webHint}
      googleConnected={conn.connected && conn.status === "active"}
      energyUsed={energyUsed}
      energyTank={ENERGY_TANK}
      deployedUrl={deployedUrl}
    />
  );
}
