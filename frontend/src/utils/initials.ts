/** "Ana Lima" → "AL", "ana@x.com" → "A". */
export function initials(name: string | null | undefined, fallback = '?') {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase() || fallback;
}
