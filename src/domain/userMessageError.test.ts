import { describe, expect, it } from 'vitest';
import { UserMessageError } from './userMessageError';

describe('UserMessageError', () => {
  it('is told apart from any other error while still carrying its message', () => {
    const mine = new UserMessageError('Too many wrong tries.');
    expect(mine).toBeInstanceOf(UserMessageError);
    expect(mine.message).toBe('Too many wrong tries.');
    expect(new Error('Failed to fetch')).not.toBeInstanceOf(UserMessageError);
  });
});
