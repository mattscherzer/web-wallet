#!/bin/bash
# Claude Code PreToolUse hook: source edits go through the Edit tool, which fails loudly when it does not apply.
cmd=$(node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).tool_input?.command??""))')
inplace='(^|[;&| ])(sed +(-[a-zA-Z]*i|--in-place)|perl +-[a-zA-Z]*i|awk +-i +inplace)'
scripted='(python3?|node) .*(write_text|\.write\(|writeFileSync|open\([^)]*, *.[wa])'
repo='(src|supabase|scripts|docs)/'
if echo "$cmd" | grep -Eq "$inplace" || { echo "$cmd" | grep -Eq "$scripted" && echo "$cmd" | grep -Eq "$repo"; }; then
  echo "Blocked: edit repo files with the Edit or Write tool, not sed -i, perl -i or a script. Those fail silently when the pattern does not match; Edit errors instead." >&2
  exit 2
fi
