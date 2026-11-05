import { Avatar } from "@virasat/ui/avatar";
import { PhotoFrame } from "@virasat/ui/card";
import { Section } from "@virasat/ui/page";
import Link from "next/link";
import type { Moment } from "@/lib/moments.ts";
import { getT } from "@/lib/i18n/server.ts";

/** "Lately in the family": the newest moments as a swipeable row on vault home. */
export async function MomentsStrip({ familyId, moments }: { familyId: string; moments: Moment[] }) {
  if (moments.length === 0) return null;
  const { t, locale } = await getT();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  return (
    <Section
      title={t("moments.stripTitle")}
      action={
        <Link
          href={`/vault/${familyId}/moments`}
          className="font-semibold text-accent underline underline-offset-4"
        >
          {t("moments.seeAll")}
        </Link>
      }
    >
      <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {moments.map((moment) => (
          <li key={moment.id} className="w-56 shrink-0 snap-start">
            <Link
              href={`/vault/${familyId}/moments`}
              className="flex h-full flex-col gap-2 rounded-lg bg-surface p-3 shadow-album ring-1 ring-border ring-inset"
            >
              {moment.photoUrl ? (
                <PhotoFrame>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={moment.photoUrl}
                    alt=""
                    className="aspect-4/3 w-full rounded-sm object-cover"
                  />
                </PhotoFrame>
              ) : (
                <Avatar name={moment.authorName || moment.recipeTitle} />
              )}
              <span className="font-serif font-semibold">{moment.recipeTitle}</span>
              <span className="text-sm text-muted">
                {t("moments.cookedBy", { name: moment.authorName })} ·{" "}
                {date.format(new Date(moment.cookedOn))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
