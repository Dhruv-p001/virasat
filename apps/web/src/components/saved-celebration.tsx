"use client";

import { ConfirmMoment } from "@virasat/ui/confirm-moment";
import { useEffect } from "react";

/**
 * A recipe has just been saved: a check settles into place once. The "just saved" marker is taken
 * off the address straight away, so a reload or a shared link does not show it again.
 */
export function SavedCelebration({ title }: { title: string }) {
  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  return <ConfirmMoment title={title} />;
}
