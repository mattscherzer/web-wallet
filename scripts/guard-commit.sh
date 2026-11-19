#!/bin/bash
# Claude Code PreToolUse hook: no git commit or push until the standards pass.
cmd=$(node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).tool_input?.command??""))')
echo "$cmd" | grep -Eq '(^|[;&| ])git +(commit|push)\b' || exit 0
out=$(npm run check 2>&1) && exit 0
{ echo "Blocked: npm run check fails. Fix the root cause of each failure below, then retry."
  echo "Never weaken a rule, edit a standards test, or add an eslint-disable to get past it."
  echo "$out" | tail -60; } >&2
exit 2
