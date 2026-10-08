// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import ReasonSheet from './ReasonSheet';

afterEach(cleanup);

function Host() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open sheet</button>
      {open && (
        <ReasonSheet
          title="Remove this entry?"
          reasons={['Duplicate', 'Other']}
          reasonLabel="Reason"
          confirmLabel="Remove entry"
          onConfirm={() => {}}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}

describe('ReasonSheet keyboard use', () => {
  it('moves focus into the dialog, keeps Tab inside, closes on Escape and returns focus', () => {
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'Open sheet' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Remove this entry?' });
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Tab from the last control wraps to the first one instead of leaving the dialog.
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    cancel.focus();
    fireEvent.keyDown(cancel, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(opener);

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
