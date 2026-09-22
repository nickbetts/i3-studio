/** Longest-name-first matching keeps "Jordan Writer" from being shadowed by a shorter "Jordan". */
export function findMentionedUserIds(text: string, candidates: { id: string; name: string }[]): string[] {
  if (!text.trim() || !candidates.length) return [];
  const lower = text.toLowerCase();
  const sorted = [...candidates].filter((c) => c.name.trim().length > 0).sort((a, b) => b.name.length - a.name.length);
  const matched = new Set<string>();
  for (const candidate of sorted) {
    const needle = `@${candidate.name}`.toLowerCase();
    if (lower.includes(needle)) matched.add(candidate.id);
  }
  return [...matched];
}
