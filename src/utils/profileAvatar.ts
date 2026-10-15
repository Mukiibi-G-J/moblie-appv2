const AVATAR_STYLES = [
  'avataaars',
  'lorelei',
  'notionists',
  'fun-emoji',
  'adventurer',
  'pixel-art',
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Deterministic generated avatar (varied style per user). */
export function getGeneratedAvatarUrl(seed: string, size = 128): string {
  const normalized = seed.trim() || 'user';
  const style = AVATAR_STYLES[hashString(normalized) % AVATAR_STYLES.length];
  const params = new URLSearchParams({
    seed: normalized,
    size: String(size),
  });
  return `https://api.dicebear.com/7.x/${style}/png?${params.toString()}`;
}

/** Use uploaded avatar when present; otherwise a generated placeholder. */
export function resolveProfileAvatarSrc(
  avatar?: string | null,
  seed?: string | null,
  size = 128,
): string {
  const uploaded = avatar?.trim();
  if (uploaded) {
    return uploaded;
  }
  return getGeneratedAvatarUrl(seed?.trim() || 'user', size);
}

export function profileInitials(
  fullName?: string | null,
  email?: string | null,
): string {
  const fromName = (fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
  if (fromName) {
    return fromName;
  }
  const e = (email || '').trim();
  return e ? e[0].toUpperCase() : '?';
}
