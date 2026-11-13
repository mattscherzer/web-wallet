// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppShellSkeleton, RouteSkeleton } from './LoadingSkeletons';
import PageLoading from './PageLoading';
import { NAV_ITEMS } from './navItems';

afterEach(cleanup);

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RouteSkeleton />
    </MemoryRouter>,
  ).container;

describe('loading screens', () => {
  it('draws the History shapes only at /history, not for one entry under it', () => {
    expect(at('/history').querySelector('.skeleton-history')).not.toBeNull();
    cleanup();
    expect(at('/history/abc').querySelector('.skeleton-history')).toBeNull();
  });

  it('draws the Overview shapes at every other address', () => {
    expect(at('/more').querySelector('.skeleton-hero')).not.toBeNull();
  });

  it('the app shell leaves one slot for each navigation item', () => {
    const { container } = render(<AppShellSkeleton />);
    expect(container.querySelectorAll('.bottom-nav__item')).toHaveLength(NAV_ITEMS.length);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
  });

  it('a page without a design shows the loading indicator, not text', () => {
    render(<PageLoading />);
    const status = screen.getByRole('status', { name: 'Loading' });
    expect(status.querySelector('svg.loading-indicator')).not.toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();
  });
});
