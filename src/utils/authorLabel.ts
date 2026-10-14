export const UNKNOWN_AUTHOR = 'Unknown / N/A';

/** Name of whoever made an entry, or a plain "unknown" for entries from before login existed. */
export function authorLabel(createdBy: string | null | undefined, names: Record<string, string>): string {
  return (createdBy && names[createdBy]) || UNKNOWN_AUTHOR;
}
