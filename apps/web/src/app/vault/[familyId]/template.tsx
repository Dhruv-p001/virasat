import type { ReactNode } from "react";

// Remounts on every navigation, replaying the short CSS fade-in (off under reduced motion).
export default function VaultTemplate({ children }: { children: ReactNode }) {
  return <div className="page-in flex flex-1 flex-col">{children}</div>;
}
