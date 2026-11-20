// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PinPad from '../components/PinPad';
import { usePinKeys } from './usePinKeys';

function Probe({
  onDigit,
  onBackspace,
  disabled = false,
}: {
  onDigit: () => void;
  onBackspace: () => void;
  disabled?: boolean;
}) {
  usePinKeys(onDigit, onBackspace, disabled);
  return (
    <>
      <input aria-label="field" />
      <textarea aria-label="notes" />
      <select aria-label="choice" />
      <div aria-label="editable" contentEditable suppressContentEditableWarning />
    </>
  );
}

function ControlledPad() {
  const [pin, setPin] = useState('');
  return <PinPad value={pin} onChange={setPin} />;
}

afterEach(cleanup);

describe('usePinKeys', () => {
  it('passes a pressed digit to onDigit', () => {
    const onDigit = vi.fn();
    render(<Probe onDigit={onDigit} onBackspace={vi.fn()} />);
    fireEvent.keyDown(document.body, { key: '3' });
    expect(onDigit).toHaveBeenCalledWith('3');
  });

  it('calls onBackspace for Backspace, including a held one', () => {
    const onBackspace = vi.fn();
    render(<Probe onDigit={vi.fn()} onBackspace={onBackspace} />);
    fireEvent.keyDown(document.body, { key: 'Backspace' });
    fireEvent.keyDown(document.body, { key: 'Backspace', repeat: true });
    expect(onBackspace).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a letter', { key: 'a' }],
    ['a held digit', { key: '1', repeat: true }],
    ['Ctrl+digit', { key: '1', ctrlKey: true }],
    ['Meta+digit', { key: '1', metaKey: true }],
    ['Alt+digit', { key: '1', altKey: true }],
    ['an IME composition', { key: '1', isComposing: true }],
  ])('ignores %s', (_name, init) => {
    const onDigit = vi.fn();
    render(<Probe onDigit={onDigit} onBackspace={vi.fn()} />);
    fireEvent.keyDown(document.body, init);
    expect(onDigit).not.toHaveBeenCalled();
  });

  it.each(['field', 'notes', 'choice', 'editable'])('ignores keys typed into %s', (label) => {
    const onDigit = vi.fn();
    const onBackspace = vi.fn();
    render(<Probe onDigit={onDigit} onBackspace={onBackspace} />);
    // jsdom does not implement isContentEditable.
    Object.defineProperty(screen.getByLabelText('editable'), 'isContentEditable', { value: true });
    fireEvent.keyDown(screen.getByLabelText(label), { key: '1' });
    fireEvent.keyDown(screen.getByLabelText(label), { key: 'Backspace' });
    expect(onDigit).not.toHaveBeenCalled();
    expect(onBackspace).not.toHaveBeenCalled();
  });

  it('ignores digits and Backspace while disabled', () => {
    const onDigit = vi.fn();
    const onBackspace = vi.fn();
    render(<Probe onDigit={onDigit} onBackspace={onBackspace} disabled />);
    fireEvent.keyDown(document.body, { key: '1' });
    fireEvent.keyDown(document.body, { key: 'Backspace' });
    expect(onDigit).not.toHaveBeenCalled();
    expect(onBackspace).not.toHaveBeenCalled();
  });
});

describe('PinPad keyboard input', () => {
  const entered = () => screen.getByRole('img').getAttribute('aria-label');

  it('fills and clears dots from the keyboard and stops at the PIN length', () => {
    render(<ControlledPad />);
    for (const key of '1234567') fireEvent.keyDown(document.body, { key });
    expect(entered()).toBe('6 of 6 digits entered');
    fireEvent.keyDown(document.body, { key: 'Backspace' });
    expect(entered()).toBe('5 of 6 digits entered');
  });
});
