export interface ErrorRate {
  /** (substitutions + deletions + insertions) / reference length. Can exceed 1. */
  rate: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  referenceLength: number;
}

const INDIC_DIGITS = /[\u0966-\u096F\u0AE6-\u0AEF]/g; // Devanagari and Gujarati digits
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const PUNCTUATION_OR_SYMBOL = /[\p{P}\p{S}]/gu;

/**
 * Normalises a transcript before scoring so formatting differences are not counted as errors.
 * Combining marks (matras, virama) are kept: they change the word in Gujarati and Hindi.
 */
export function normalizeTranscript(text: string): string {
  return text
    .normalize("NFC")
    .replace(ZERO_WIDTH, "")
    .replace(INDIC_DIGITS, (d) => {
      const code = d.codePointAt(0) ?? 0;
      return String(code - (code >= 0x0ae6 ? 0x0ae6 : 0x0966));
    })
    .toLowerCase()
    .replace(PUNCTUATION_OR_SYMBOL, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Word error rate on normalised text. */
export function wordErrorRate(reference: string, hypothesis: string): ErrorRate {
  const split = (text: string) => {
    const normalized = normalizeTranscript(text);
    return normalized ? normalized.split(" ") : [];
  };
  return editDistance(split(reference), split(hypothesis));
}

/**
 * Character error rate over grapheme clusters, with spaces removed. More forgiving than WER for
 * Gujarati and Hindi, where providers often split or join words differently.
 */
export function characterErrorRate(reference: string, hypothesis: string): ErrorRate {
  const split = (text: string) =>
    Array.from(graphemes.segment(normalizeTranscript(text).replace(/ /g, "")), (s) => s.segment);
  return editDistance(split(reference), split(hypothesis));
}

function editDistance(reference: string[], hypothesis: string[]): ErrorRate {
  const rows = reference.length + 1;
  const cols = hypothesis.length + 1;
  // Each cell holds [cost, substitutions, deletions, insertions] for the best alignment so far.
  type Cell = [number, number, number, number];
  let previous: Cell[] = Array.from({ length: cols }, (_, j): Cell => [j, 0, 0, j]);

  for (let i = 1; i < rows; i++) {
    const current: Cell[] = [[i, 0, i, 0]];
    for (let j = 1; j < cols; j++) {
      const diag = previous[j - 1] as Cell;
      const up = previous[j] as Cell;
      const left = current[j - 1] as Cell;
      const same = reference[i - 1] === hypothesis[j - 1];
      const candidates: Cell[] = [
        [diag[0] + (same ? 0 : 1), diag[1] + (same ? 0 : 1), diag[2], diag[3]],
        [up[0] + 1, up[1], up[2] + 1, up[3]],
        [left[0] + 1, left[1], left[2], left[3] + 1],
      ];
      current.push(candidates.reduce((best, c) => (c[0] < best[0] ? c : best)));
    }
    previous = current;
  }

  const [cost, substitutions, deletions, insertions] = previous[cols - 1] as Cell;
  const referenceLength = reference.length;
  const rate = referenceLength === 0 ? (cost === 0 ? 0 : 1) : cost / referenceLength;
  return { rate, substitutions, deletions, insertions, referenceLength };
}
