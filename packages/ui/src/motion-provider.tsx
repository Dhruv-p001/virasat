"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

// The animation features load after first paint, so they never block it.
const loadFeatures = () => import("./motion-features.ts").then((module) => module.default);

/**
 * The single reduced-motion guard for Motion: `reducedMotion="user"` turns movement into
 * instant changes when the viewer asks for less motion. CSS animations are covered in styles.css.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadFeatures} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
