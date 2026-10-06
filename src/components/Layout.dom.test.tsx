// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Layout from './Layout';

afterEach(cleanup);

function shell(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          {['/', '/history', '/add', '/reports'].map((p) => (
            <Route key={p} path={p} element={<p>page {p}</p>} />
          ))}
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Layout shell', () => {
  it('shows the Record button on Overview and History but not on other pages', () => {
    for (const [path, shown] of [
      ['/', true],
      ['/history', true],
      ['/add', false],
      ['/reports', false],
    ] as const) {
      shell(path);
      expect(screen.queryByRole('button', { name: 'Record' }) !== null, path).toBe(shown);
      cleanup();
    }
  });
});
