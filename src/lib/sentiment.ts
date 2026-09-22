// Lightweight deterministic lexicon scorer — no external API/network calls, so it can run
// on every comment/message as they're written. Good enough as a first pass; swap the
// scoring internals later if a real NLP/LLM-based classifier is wanted, the call sites
// (client-sentiment.ts) won't need to change.
const POSITIVE_WORDS = [
  "great", "love", "loved", "loving", "excellent", "amazing", "awesome", "perfect", "fantastic",
  "happy", "pleased", "delighted", "thanks", "thank", "appreciate", "appreciated", "impressed",
  "smooth", "easy", "clear", "nice", "good", "wonderful", "brilliant", "excited", "glad",
  "helpful", "quick", "fast", "seamless", "beautiful", "exactly", "spot on", "well done", "superb",
];

const NEGATIVE_WORDS = [
  "bad", "terrible", "awful", "hate", "hated", "frustrated", "frustrating", "confused", "confusing",
  "disappointed", "disappointing", "unhappy", "broken", "delay", "delayed", "late", "issue", "issues",
  "problem", "problems", "concerned", "concerning", "worried", "worry", "unacceptable", "poor", "slow",
  "annoyed", "annoying", "upset", "wrong", "mistake", "mistakes", "missed", "fail", "failed", "failing",
  "not happy", "not working", "not good", "don't like", "still waiting", "again", "unresolved",
];

const NEGATIONS = ["not", "no", "never", "isn't", "wasn't", "aren't", "doesn't", "don't", "didn't", "can't", "won't"];

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9'\s]/g, " ").split(/\s+/).filter(Boolean);
}

/** Returns a score roughly in [-1, 1]; 0 for empty/neutral text. */
export function scoreSentimentText(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const lower = trimmed.toLowerCase();
  let hits = 0;
  let score = 0;
  for (const phrase of POSITIVE_WORDS) if (lower.includes(phrase)) { hits += 1; score += 1; }
  for (const phrase of NEGATIVE_WORDS) if (lower.includes(phrase)) { hits += 1; score -= 1; }
  const tokens = tokenize(trimmed);
  const negationCount = tokens.filter((token) => NEGATIONS.includes(token)).length;
  if (negationCount > 0 && hits > 0) score *= -0.5; // crude negation dampening/flip
  if (hits === 0) return 0;
  return Math.max(-1, Math.min(1, score / Math.max(2, hits)));
}

export type SentimentLabel = "positive" | "neutral" | "at_risk";

export function sentimentLabel(score: number): SentimentLabel {
  if (score >= 0.2) return "positive";
  if (score <= -0.2) return "at_risk";
  return "neutral";
}

/** Maps a -1..1 average score onto a 0-100 index, 50 = neutral baseline. */
export function scoreToIndex(score: number): number {
  return Math.round(Math.max(0, Math.min(100, 50 + score * 50)));
}
