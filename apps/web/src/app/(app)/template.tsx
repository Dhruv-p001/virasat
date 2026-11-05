import type { ReactNode } from "react";

// A template remounts on every navigation, which replays the short fade-in (pure CSS, and
// switched off under prefers-reduced-motion).
export default function AppTemplate({ children }: { children: ReactNode }) {
  return <div className="page-in flex flex-1 flex-col">{children}</div>;
}
