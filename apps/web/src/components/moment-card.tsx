import { Avatar } from "@virasat/ui/avatar";
import { Card, PhotoFrame } from "@virasat/ui/card";
import { Star } from "lucide-react";
import type { ReactNode } from "react";

/**
 * One "I cooked it" moment: the photo as a print, the note in the cook's own words, who and when.
 * Shared by the sample vault and the real Moments page. Text arrives translated.
 */
export function MomentCard({
  authorName,
  authorPhotoUrl,
  byline,
  dateText,
  recipeTitle,
  rating,
  ratingLabel,
  note,
  photoUrl,
  photoAlt,
  action,
}: {
  authorName: string;
  authorPhotoUrl?: string | null;
  /** "Cooked by Mom" */
  byline: string;
  dateText: string;
  recipeTitle: string;
  rating: number | null;
  /** "4 out of 5 stars", for screen readers. */
  ratingLabel?: string;
  note: string | null;
  photoUrl: string | null;
  photoAlt: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3" data-testid="moment">
      {photoUrl && (
        <PhotoFrame>
          {/* A plain img: moment photos are signed private URLs, and sample photos are static. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt={photoAlt}
            className="aspect-4/3 w-full rounded-sm object-cover"
          />
        </PhotoFrame>
      )}
      <div className="flex items-center gap-3">
        <Avatar name={authorName} photoUrl={authorPhotoUrl} />
        <div className="flex min-w-0 flex-col">
          <span className="font-serif text-lg font-semibold">{recipeTitle}</span>
          <span className="text-sm text-muted">
            {byline} · {dateText}
          </span>
        </div>
      </div>
      {rating !== null && (
        <span role="img" aria-label={ratingLabel} className="flex gap-0.5 text-accent">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              aria-hidden
              className="size-5"
              fill={n <= rating ? "currentColor" : "none"}
              strokeWidth={1.75}
            />
          ))}
        </span>
      )}
      {note && <p className="text-lg italic">“{note}”</p>}
      {action}
    </Card>
  );
}
