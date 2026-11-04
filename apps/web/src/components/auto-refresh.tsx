"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-reads the page's data every few seconds while something on it is still being worked on. */
export function AutoRefresh({ active, everyMs = 3000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      router.refresh();
    }, everyMs);
    return () => {
      clearInterval(timer);
    };
  }, [active, everyMs, router]);
  return null;
}
