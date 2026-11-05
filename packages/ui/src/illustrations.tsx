import type { ReactNode } from "react";
import { cn } from "./cn.ts";

// Small hand-drawn-style scenes for the landing page, sign-in, first run and empty states
// (ADR 0018). Plain server-safe SVG: no JavaScript, no image files. Every colour comes from the
// theme through Tailwind's fill-* and stroke-* classes, so one drawing serves light and dark.
// They are decoration, so screen readers skip them. The elder's /record page imports none of them.

function Art({ className, children }: { className?: string | undefined; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 200 150"
      aria-hidden="true"
      focusable="false"
      className={cn("h-auto w-full", className)}
    >
      {children}
    </svg>
  );
}

type ArtProps = { className?: string | undefined };

/** A microphone with sound arcs: recording someone telling it. */
export function MicArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      <circle cx="100" cy="75" r="62" className="fill-sunken" />
      <rect x="88" y="38" width="24" height="46" rx="12" className="fill-accent" />
      <path
        d="M76 76a24 24 0 0 0 48 0M100 100v18M86 118h28"
        className="fill-none stroke-ink"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <g className="fill-none stroke-accent" strokeWidth="3" strokeLinecap="round">
        <path d="M133 60q9 15 0 30M144 50q14 25 0 50" />
        <path d="M67 60q-9 15 0 30M56 50q-14 25 0 50" />
      </g>
    </Art>
  );
}

/** A lined page with handwriting and a pencil: a diary page or a recipe card. */
export function PageArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      <circle cx="100" cy="75" r="62" className="fill-sunken" />
      <g transform="rotate(-5 100 75)">
        <rect
          x="58"
          y="24"
          width="84"
          height="102"
          rx="6"
          className="fill-surface stroke-border"
          strokeWidth="2"
        />
        <g className="fill-none stroke-border" strokeWidth="1.5">
          <path d="M66 50h68M66 64h68M66 78h68M66 92h68M66 106h68" />
        </g>
        <g className="fill-none stroke-ink" strokeWidth="2" strokeLinecap="round" opacity="0.7">
          <path d="M68 47q5-6 10 0t10 0t10 0t10 0" />
          <path d="M68 61q5-6 10 0t10 0t10 0" />
          <path d="M68 75q5-6 10 0t10 0t10 0t10 0t8 0" />
          <path d="M68 89q5-6 10 0t10 0" />
        </g>
        <path
          d="M118 40c-3-3-8 0-6 4l6 6 6-6c2-4-3-7-6-4z"
          transform="translate(4 -6) scale(.9)"
          className="fill-accent"
        />
      </g>
      <g transform="rotate(38 138 100)">
        <rect x="132" y="70" width="12" height="52" rx="2" className="fill-accent" />
        <path d="M132 122l6 12 6-12z" className="fill-ink" />
        <rect x="132" y="70" width="12" height="8" rx="2" className="fill-surface" />
      </g>
    </Art>
  );
}

/** A round table with a steaming pot and three people: a recipe kept for the family. */
export function FamilyArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      <ellipse cx="100" cy="124" rx="84" ry="14" className="fill-sunken" />
      <g className="fill-accent">
        <circle cx="52" cy="54" r="11" opacity="0.9" />
        <path d="M34 92c0-16 8-24 18-24s18 8 18 24z" opacity="0.9" />
        <circle cx="100" cy="42" r="11" opacity="0.65" />
        <path d="M82 80c0-16 8-24 18-24s18 8 18 24z" opacity="0.65" />
        <circle cx="148" cy="54" r="11" opacity="0.9" />
        <path d="M130 92c0-16 8-24 18-24s18 8 18 24z" opacity="0.9" />
      </g>
      <path
        d="M36 100h128v8c0 6-28 12-64 12s-64-6-64-12z"
        className="fill-sunken stroke-border"
        strokeWidth="2"
      />
      <ellipse
        cx="100"
        cy="100"
        rx="64"
        ry="14"
        className="fill-surface stroke-border"
        strokeWidth="2"
      />
      <path d="M84 92h32v6a16 8 0 0 1-32 0z" className="fill-ink" />
      <ellipse cx="100" cy="92" rx="18" ry="5" className="fill-ink" />
      <ellipse
        cx="68"
        cy="102"
        rx="10"
        ry="4"
        className="fill-sunken stroke-border"
        strokeWidth="1.5"
      />
      <ellipse
        cx="134"
        cy="102"
        rx="10"
        ry="4"
        className="fill-sunken stroke-border"
        strokeWidth="1.5"
      />
      <g className="steam fill-none stroke-accent" strokeWidth="3" strokeLinecap="round">
        <path d="M92 84q-6-8 0-14t0-12" />
        <path d="M108 84q-6-8 0-14t0-12" />
      </g>
    </Art>
  );
}

/** A recipe card with a heart: a recipe that is loved. */
export function RecipeArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      <circle cx="100" cy="75" r="62" className="fill-sunken" />
      <g transform="rotate(4 100 75)">
        <rect
          x="56"
          y="26"
          width="88"
          height="98"
          rx="8"
          className="fill-surface stroke-border"
          strokeWidth="2"
        />
        <path
          d="M100 84c-14-10-24-18-24-30a12 12 0 0 1 24-4a12 12 0 0 1 24 4c0 12-10 20-24 30z"
          className="fill-accent"
        />
        <g className="fill-none stroke-border" strokeWidth="2.5" strokeLinecap="round">
          <path d="M72 98h56M80 110h40" />
        </g>
      </g>
      <g className="fill-accent" opacity="0.8">
        <path d="M152 36l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" />
        <path d="M46 98l1.8 4.2 4.2 1.8-4.2 1.8L46 110l-1.8-4.2L40 104l4.2-1.8z" />
      </g>
    </Art>
  );
}

/** A pot with a wooden spoon and steam: cooking at home. */
export function PotArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      <ellipse cx="100" cy="126" rx="62" ry="9" className="fill-sunken" />
      <g className="stroke-ink" strokeLinecap="round">
        <path d="M146 30l-26 62" strokeWidth="5" />
      </g>
      <ellipse cx="148" cy="26" rx="8" ry="11" transform="rotate(24 148 26)" className="fill-ink" />
      <path d="M62 72h76v28a22 22 0 0 1-22 22H84a22 22 0 0 1-22-22z" className="fill-accent" />
      <rect x="56" y="64" width="88" height="12" rx="6" className="fill-ink" opacity="0.85" />
      <rect x="46" y="82" width="14" height="6" rx="3" className="fill-ink" opacity="0.85" />
      <rect x="140" y="82" width="14" height="6" rx="3" className="fill-ink" opacity="0.85" />
      <path
        d="M72 88q0 18 14 26"
        className="fill-none stroke-surface"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.5"
      />
      <g className="steam fill-none stroke-accent" strokeWidth="3" strokeLinecap="round">
        <path d="M84 54q-7-9 0-16t0-14" />
        <path d="M100 54q-7-9 0-16t0-14" />
        <path d="M116 54q-7-9 0-16t0-14" />
      </g>
    </Art>
  );
}

/** An empty bowl with a wisp of steam and sparkles: nothing here yet. */
export function QuietArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      <ellipse cx="100" cy="120" rx="58" ry="8" className="fill-sunken" />
      <path
        d="M54 80h92c0 26-18 40-46 40S54 106 54 80z"
        className="fill-surface stroke-border"
        strokeWidth="2.5"
      />
      <ellipse
        cx="100"
        cy="80"
        rx="46"
        ry="8"
        className="fill-sunken stroke-border"
        strokeWidth="2.5"
      />
      <path
        d="M100 66q-7-8 0-15t0-13"
        className="steam fill-none stroke-accent"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <g className="fill-accent" opacity="0.8">
        <path d="M142 44l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" />
        <path d="M58 52l1.8 4.2 4.2 1.8-4.2 1.8L58 64l-1.8-4.2L52 58l4.2-1.8z" />
      </g>
    </Art>
  );
}
