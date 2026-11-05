import { Avatar } from "@virasat/ui/avatar";
import { interactiveCard } from "@virasat/ui/card";
import { Section } from "@virasat/ui/page";
import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/ui.tsx";
import { getT } from "@/lib/i18n/server.ts";
import { getSamplePerson, sampleLabel, sampleVault } from "@/lib/sample.ts";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return [sampleVault.viewer, ...sampleVault.people].map((person) => ({ slug: person.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getSamplePerson((await params).slug).relationLabel };
}

export default async function SamplePersonPage({ params }: Props) {
  const person = getSamplePerson((await params).slug);
  const { t } = await getT();
  const label = sampleLabel(person, t);
  const recipes = sampleVault.recipes.filter((recipe) => recipe.originPerson === person.slug);

  return (
    <PageShell title={label} back={{ href: "/sample", label: t("sample.back") }}>
      <div className="-mt-4 flex items-center gap-5">
        <Avatar name={label} photoUrl={person.photo} size="lg" />
        <div className="flex flex-col gap-1">
          {person.slug !== sampleVault.viewer.slug && (
            <span className="text-lg">{person.displayName}</span>
          )}
          {person.birthYear && (
            <span className="text-muted">{t("person.born", { year: person.birthYear })}</span>
          )}
        </div>
      </div>
      <p className="text-lg leading-relaxed">{person.about}</p>

      {recipes.length > 0 && (
        <Section title={t("sample.recipes")}>
          <ul className="grid gap-4 sm:grid-cols-2">
            {recipes.map((recipe) => (
              <li key={recipe.slug}>
                <Link
                  href={`/sample/recipes/${recipe.slug}`}
                  className={`${interactiveCard} flex flex-col gap-1`}
                >
                  <span className="font-serif text-xl font-semibold">{recipe.recipe.title}</span>
                  <span className="text-sm text-muted">{t(`sample.source.${recipe.source}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </PageShell>
  );
}
