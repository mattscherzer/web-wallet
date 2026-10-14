export const UNKNOWN_AUTHOR = 'Unknown / N/A';

/** Who made an entry, from the name and role stored with it: "Anna (staff)". Old entries have none and read as unknown. */
export function authorLabel(author: { created_by_name?: string | null; created_by_role?: string | null }): string {
  const name = author.created_by_name?.trim();
  if (!name) return UNKNOWN_AUTHOR;
  return author.created_by_role ? `${name} (${author.created_by_role})` : name;
}
