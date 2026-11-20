import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const run = (command) =>
  spawnSync('bash', ['scripts/guard-edits.sh'], { input: JSON.stringify({ tool_input: { command } }) }).status;

describe('edit guard hook', () => {
  it.each([
    "sed -i '' 's/a/b/' src/a.ts",
    "sed -i.bak 's/a/b/' src/a.ts",
    "perl -pi -e 's/a/b/' src/a.ts",
    "python3 -c \"open('src/a.ts','w').write('x')\"",
    "node -e \"require('fs').writeFileSync('src/a.ts','x')\"",
  ])('blocks %s', (command) => expect(run(command)).toBe(2));

  it.each(['sed -n 1,20p src/a.ts', 'git status', 'npx vitest run', 'python3 -c "print(open(\'src/a.ts\').read())"'])(
    'allows %s',
    (command) => expect(run(command)).toBe(0),
  );
});
