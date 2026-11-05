"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

const BARS = [30, 55, 40, 80, 50, 95, 65, 45, 75, 35, 60, 25, 70, 40];

/**
 * The recording with a row of bars beside it that move while it plays. The bars are decoration (a
 * stand-in for her voice, not a reading of it), so screen readers skip them. The player is the
 * browser's own, which is accessible and works everywhere. The bars stop under reduced motion.
 */
export function RecipeAudio({ src, label }: { src: string; label: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div data-playing={playing} className="flex flex-col gap-3">
      <div
        aria-hidden
        className="flex h-12 items-center justify-center gap-1.5 rounded-md bg-sunken px-4"
      >
        {BARS.map((height, index) => (
          <span
            key={index}
            className="wave-bar w-1.5 rounded-full bg-accent"
            style={{ height: `${height}%`, "--i": index } as CSSProperties}
          />
        ))}
      </div>
      <audio
        controls
        preload="metadata"
        src={src}
        aria-label={label}
        className="w-full"
        onPlay={() => {
          setPlaying(true);
        }}
        onPause={() => {
          setPlaying(false);
        }}
        onEnded={() => {
          setPlaying(false);
        }}
      />
    </div>
  );
}
