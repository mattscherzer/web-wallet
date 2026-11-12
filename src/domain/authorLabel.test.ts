import { describe, expect, it } from 'vitest';
import { UNKNOWN_AUTHOR, authorLabel } from './authorLabel';

describe('authorLabel', () => {
  it('shows the name with the role', () => {
    expect(authorLabel({ created_by_name: 'Anna', created_by_role: 'staff' })).toBe('Anna (staff)');
  });

  it('shows the bare name when the role is missing', () => {
    expect(authorLabel({ created_by_name: ' Anna ' })).toBe('Anna');
  });

  it('reads old entries without a name as unknown', () => {
    expect(authorLabel({ created_by_name: '  ', created_by_role: 'owner' })).toBe(UNKNOWN_AUTHOR);
    expect(authorLabel({})).toBe(UNKNOWN_AUTHOR);
  });
});
