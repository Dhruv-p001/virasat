import { resources } from "@virasat/i18n";

const t = resources.en.translation;

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">{t.app.name}</h1>
      <p className="text-lg text-muted">{t.empty.firstRecipe}</p>
    </main>
  );
}
