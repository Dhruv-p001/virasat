import { Avatar } from "@virasat/ui/avatar";
import { ChevronRight } from "lucide-react";

export type LineageLink = { name: string; photoUrl?: string | null };

/**
 * Ba → Mom → you: who a recipe passed through, oldest first, with the words that went with each
 * handover. Names arrive translated, so this works for the sample vault and real lineage alike.
 */
export function LineageStrip({
  title,
  chain,
  messages,
}: {
  title: string;
  chain: LineageLink[];
  /** One message per handover: messages[i] went from chain[i] to chain[i + 1]. */
  messages: string[];
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-4">
      <ol className="flex flex-wrap items-center gap-2">
        {chain.map((link, index) => (
          <li key={`${link.name}-${index}`} className="flex items-center gap-2">
            <span className="flex items-center gap-2 rounded-full bg-surface py-1 ps-1 pe-4 shadow-album ring-1 ring-border ring-inset">
              <Avatar name={link.name} photoUrl={link.photoUrl} />
              <span className="font-serif font-semibold">{link.name}</span>
            </span>
            {index < chain.length - 1 && (
              <ChevronRight aria-hidden className="size-5 text-muted rtl:rotate-180" />
            )}
          </li>
        ))}
      </ol>
      <ul className="flex flex-col gap-3">
        {messages.map((message, index) => (
          <li key={index} className="border-s-4 border-border ps-4">
            <p className="text-lg italic">“{message}”</p>
            <p className="text-sm text-muted">
              {chain[index]?.name} → {chain[index + 1]?.name}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
