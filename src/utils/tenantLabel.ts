/** Human-readable label from tenant slug when API name is unavailable. */
export function formatTenantLabel(slug: string | null): string {
  if (!slug?.trim()) {
    return 'Your business';
  }
  return slug
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
