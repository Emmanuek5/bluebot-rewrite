// swearWords.ts

/**
 * Expanded default list + robust merging/normalization helpers.
 *
 * Notes:
 * - Includes multi-word phrases.
 * - Adds common censored variants (f*ck, sh*t, etc).
 * - During merge we also add:
 *    - punctuation-stripped variants (sh!t -> sht / shit-like depending on input)
 *    - spaced-out variants (f u c k)
 * - You can still pass custom words/phrases.
 */

export const DEFAULT_SWEAR_WORDS: string[] = [
  // --- Core profanity ---
  "fuck",
  "fucker",
  "fucking",
  "motherfucker",
  "motherfucking",
  "mf",
  "shit",
  "shitty",
  "bullshit",
  "horseshit",
  "bitch",
  "bitches",
  "son of a bitch",
  "ass",
  "asshole",
  "dumbass",
  "jackass",
  "bastard",
  "damn",
  "goddamn",
  "hell",

  // --- Sexual / vulgar ---
  "dick",
  "dickhead",
  "cock",
  "pussy",
  "twat",
  "cunt",
  "slut",
  "whore",
  "hoe",
  "blowjob",
  "handjob",

  // --- Body / gross ---
  "piss",
  "pissed",
  "crap",
  "crappy",
  "scumbag",

  // --- Common insults (non-racial) ---
  "retard",
  "retarded",
  "idiot",
  "moron",
  "imbecile",
  "jerk",
  "loser",
  "prick",
  "wanker",
  "tosser",

  // --- Common phrases ---
  "piece of shit",
  "go to hell",
  "fuck you",
  "screw you",
  "shut the fuck up",
  "holy shit",
  "what the hell",
  "what the fuck",

  // --- Censored / leetspeak common forms ---
  "f*ck",
  "f**k",
  "fu*k",
  "sh*t",
  "s**t",
  "b*tch",
  "a**hole",
  "c*nt",
  "d*ck",

  // --- Mild-ish (optional, but commonly filtered) ---
  "wtf",
  "stfu",
];

/** Normalize whitespace + case */
function normalizeWord(word: string): string {
  return word.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Remove punctuation but keep letters, numbers, spaces (for multi-word phrases) */
function stripNonLetters(word: string): string {
  return word.replace(/[^a-z0-9\s]/g, "");
}

/**
 * Create a spaced-out variant:
 * "fuck" -> "f u c k"
 * For phrases, we remove spaces first: "fuck you" -> "f u c k y o u"
 */
function spacedOutVariant(word: string): string | null {
  const cleaned = stripNonLetters(normalizeWord(word)).replace(/\s+/g, "");
  if (cleaned.length < 3) return null;
  return cleaned.split("").join(" ");
}

/**
 * Merge default + custom swear words into a normalized unique array.
 * Adds a few extra derived variants to catch common obfuscations.
 */
export function mergeSwearWords(custom: string[] | undefined): string[] {
  const merged = new Set<string>();

  function add(word: string) {
    const normalized = normalizeWord(word);
    if (!normalized) return;

    // Base
    merged.add(normalized);

    // Punctuation-stripped (e.g., "sh!t" -> "sht", "f*ck" -> "fck")
    const stripped = stripNonLetters(normalized);
    if (stripped && stripped !== normalized) merged.add(stripped);

    // Spaced-out (e.g., "fuck" -> "f u c k")
    const spaced = spacedOutVariant(normalized);
    if (spaced) merged.add(spaced);
  }

  for (const w of DEFAULT_SWEAR_WORDS) add(w);

  if (custom) {
    for (const w of custom) add(w);
  }

  return Array.from(merged);
}
