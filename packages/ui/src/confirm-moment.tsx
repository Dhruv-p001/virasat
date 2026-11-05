"use client";

import { Check } from "lucide-react";
import { m } from "motion/react";
import type { ReactNode } from "react";
import { MotionProvider } from "./motion-provider.tsx";

/**
 * A subtle celebration for a finished thing (recipe saved, handed down): a check settles into
 * place. Brings its own MotionProvider, so pages that never show it ship no Motion code.
 * Under reduced motion it simply appears.
 */
export function ConfirmMoment({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <MotionProvider>
      <div role="status" className="flex flex-col items-center gap-3 py-6 text-center">
        <m.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="flex size-16 items-center justify-center rounded-full bg-success text-paper"
        >
          <Check aria-hidden className="size-8" strokeWidth={3} />
        </m.span>
        <h2 className="text-2xl">{title}</h2>
        {children}
      </div>
    </MotionProvider>
  );
}
