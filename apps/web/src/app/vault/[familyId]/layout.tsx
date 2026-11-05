import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell.tsx";

export default async function VaultLayout({
  params,
  children,
}: {
  params: Promise<{ familyId: string }>;
  children: ReactNode;
}) {
  const { familyId } = await params;
  return <AppShell familyId={familyId}>{children}</AppShell>;
}
