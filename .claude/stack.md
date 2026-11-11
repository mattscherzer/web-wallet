# Stack profile
stack: TypeScript, React + Vite, React Router, Supabase, Vitest
install: npm install
typecheck: npm run typecheck
lint: npm run lint
build: npm run build
test-all: npx vitest run
test-one: npx vitest run --reporter=default --reporter=json --outputFile.json={report} {files}
test-report: vitest-json
test-file-regex: (^|/)(__tests__|__mocks__|tests?|fixtures)/|\.(test|spec)\.[cm]?[jt]sx?$|(^|/)(setupTests|vitest\.setup)\.[cm]?[jt]sx?$
env-files: .env

## Test rules
- Never run bare `vitest` or `npm test` without `run`: watch mode hangs.
- Wrap components using routing hooks (`useNavigate`, `useParams`, `Link`) in `<MemoryRouter>`.
- Never make live Supabase requests in unit tests: use the fake client (`src/test/fakeSupabase.ts`) through `vi.mock`.

## Review checklist
- Apply `docs/coding-standards.md`; report violations of rules tagged `review` with the rule number.
