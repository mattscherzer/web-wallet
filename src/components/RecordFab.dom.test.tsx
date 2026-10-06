// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { RecordFab } from './RecordFab';

afterEach(cleanup);

function Nav() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate('/reports')}>go-reports</button>
      <button onClick={() => navigate(-1)}>go-back</button>
    </>
  );
}

function setup(path = '/') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Nav />
      <RecordFab />
    </MemoryRouter>,
  );
}

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Record' }));
const fab = () => document.getElementById('record-fab');

describe('RecordFab interaction', () => {
  it('opens the menu when Record is pressed and focuses the first item', () => {
    setup();
    expect(screen.queryByRole('menu')).toBeNull();
    open();
    expect(screen.getByRole('menu', { name: 'Record' })).toBeTruthy();
    expect(screen.getAllByRole('menuitem').map((e) => e.textContent)).toEqual(['Money in', 'Money out', 'Transfer']);
    expect(document.activeElement).toBe(screen.getAllByRole('menuitem')[0]);
  });

  it('closes from the close button', () => {
    setup();
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Close record menu' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(fab());
    expect(fab()?.getAttribute('aria-label')).toBe('Record');
  });

  it('stays closed after leaving the page and coming back', () => {
    setup();
    open();
    fireEvent.click(screen.getByText('go-reports'));
    expect(screen.queryByRole('button', { name: 'Record' })).toBeNull();
    fireEvent.click(screen.getByText('go-back'));
    expect(screen.getByRole('button', { name: 'Record' })).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes from the scrim and returns focus to the button', () => {
    setup();
    open();
    fireEvent.click(document.querySelector('.record-scrim')!);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(fab());
  });

  it('closes on Escape and returns focus to the button', () => {
    setup();
    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(fab());
  });

  it('closes when focus leaves the menu', () => {
    setup();
    open();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    act(() => outside.focus());
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('choosing an item leaves the menu closed', () => {
    setup();
    open();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Money out' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
