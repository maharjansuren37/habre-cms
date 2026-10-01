#!/usr/bin/env bash
# Merge a spec's "## Behaviour changes" into blueprint/capabilities/, one file per
# capability. ship runs it before its other Step 2 writes; verify --all runs it on
# an old archive it has just given a section.
#
#   lib/merge-capabilities.sh SPEC-OR-ARCHIVE ARCHIVE-NAME [--target DIR]
#
# ARCHIVE-NAME is <dir>/<file without .md> - features/03-auth - the provenance
# written beside each claim. DIR is the part's directory, default the current one.
# Prints the ID of every claim it added, one per line.
#
# The section's lines (a claim is one observable behaviour):
#   - Adds to `cap`: <claim> - Step N
#   - Changes `cap.N` from "<old text>" to "<new text>" - Step N
#   - Removes `cap.N`: <why>
#   - New capability `cap`: <claim> - Step N
#   - Left out: <claim> - <why>          (seeding's record; merges nothing)
# A step is `Step N` - which must be ticked in the spec - or `seeded`, for a claim
# verify saw hold. "None" is an answer. A missing section is not: it means nothing
# declared what this item changed.
#
# Everything is checked before anything is written - every ID exists and is not a
# tombstone, every old text matches the file's current text, every step is ticked -
# so a refusal leaves every file byte-identical.
set -euo pipefail

TARGET="$PWD"
ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --target) TARGET="${2:?--target needs a directory}"; shift 2 ;;
    --help|-h) sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; exit 1 ;;
    *) ARGS+=("$1"); shift ;;
  esac
done
[ "${#ARGS[@]}" -eq 2 ] || { echo "usage: merge-capabilities.sh SPEC ARCHIVE-NAME [--target DIR]" >&2; exit 1; }
[ -f "${ARGS[0]}" ] || { echo "No such file: ${ARGS[0]}" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "merge-capabilities.sh needs python3" >&2; exit 1; }

exec python3 - "${ARGS[0]}" "${ARGS[1]}" "$TARGET" <<'PY'
import os, re, sys
spec_path, archive, target = sys.argv[1:4]
cap_dir = os.path.join(target, "blueprint/capabilities")

def refuse(msg):
    print(f"{spec_path}: {msg}. Nothing was written.", file=sys.stderr)
    sys.exit(1)

text = open(spec_path).read().split("\n")

def section(title):
    body, on, fence = None, False, False
    for l in text:
        if l.lstrip().startswith("```"):
            fence = not fence
        if not fence and l.startswith("## "):
            on = l.strip() == "## " + title
            if on:
                body = []
            continue
        if on:
            body.append(l)
    return body

body = section("Behaviour changes")
if body is None:
    refuse("no '## Behaviour changes' section - nothing declared what this item changed")
lines = [l for l in body if l.strip()]
if not lines or re.match(r"^(none)\b", lines[0].strip(), re.I) and len(lines) == 1:
    sys.exit(0)

ticked = set(re.findall(r"^- \[[xX]\] \*\*Step (\d+)\b", "\n".join(section("Build steps") or []), re.M))

NAME = r"[a-z0-9][a-z0-9-]*"
STEP = r"\s-\s(Step (\d+)|seeded)$"
ADD = re.compile(rf"^- Adds to `({NAME})`: (.+?){STEP}")
NEW = re.compile(rf"^- New capability `({NAME})`: (.+?){STEP}")
CHG = re.compile(rf'^- Changes `({NAME})\.(\d+)` from "(.*)" to "(.*)"{STEP}')
REM = re.compile(rf"^- Removes `({NAME})\.(\d+)`: (\S.*)$")
LEFT = re.compile(r"^- Left out: ")
CLAIM = re.compile(rf"^- \*\*({NAME})\.(\d+)\*\* - (.*?) \*Since:\* (\S+)(?: · \*Changed:\* (\S+))?$")
TOMB = re.compile(rf"^- ({NAME})\.(\d+) - removed by (\S+)$")

def load(cap):
    """claims: {n: [text, since, changed]}, tombs: {n: by}, None if no file."""
    path = os.path.join(cap_dir, cap + ".md")
    if not os.path.exists(path):
        return None
    claims, tombs = {}, {}
    for l in open(path).read().split("\n"):
        m = CLAIM.match(l)
        if m and m[1] == cap:
            claims[int(m[2])] = [m[3], m[4], m[5]]
            continue
        m = TOMB.match(l)
        if m and m[1] == cap:
            tombs[int(m[2])] = m[3]
    return {"claims": claims, "tombs": tombs}

def render(cap, st):
    out = [f"# Capability: {cap}", ""]
    for n in sorted(st["claims"]):
        t, since, ch = st["claims"][n]
        out.append(f"- **{cap}.{n}** - {t} *Since:* {since}" + (f" · *Changed:* {ch}" if ch else ""))
    if st["tombs"]:
        out += ["", "## Removed"] + [f"- {cap}.{n} - removed by {st['tombs'][n]}" for n in sorted(st["tombs"])]
    return "\n".join(out) + "\n"

state, made, assigned = {}, set(), []

def get(cap):
    if cap not in state:
        state[cap] = load(cap)
    return state[cap]

def need_step(m, l, at):
    if m[at + 1]:  # "Step N"
        if m[at + 2] not in ticked:
            refuse(f"'{l}': Step {m[at + 2]} is not ticked in the spec's build steps")

def nxt(st):
    return max(list(st["claims"]) + list(st["tombs"]) + [0]) + 1

for l in lines:
    l = l.rstrip()
    if LEFT.match(l):
        continue
    if m := NEW.match(l):
        cap = m[1]
        if get(cap) is None:
            state[cap] = {"claims": {}, "tombs": {}}; made.add(cap)
        elif cap not in made:
            refuse(f"'{l}': capability {cap} already exists - say 'Adds to'")
        need_step(m, l, 2)
        n = nxt(state[cap]); state[cap]["claims"][n] = [m[2], archive, None]; assigned.append(f"{cap}.{n}")
    elif m := ADD.match(l):
        cap = m[1]
        if get(cap) is None:
            refuse(f"'{l}': no capability {cap} - say 'New capability' to create it")
        need_step(m, l, 2)
        n = nxt(state[cap]); state[cap]["claims"][n] = [m[2], archive, None]; assigned.append(f"{cap}.{n}")
    elif m := CHG.match(l):
        cap, n = m[1], int(m[2])
        st = get(cap)
        if st is None or n not in st["claims"]:
            why = "is removed" if st and n in st["tombs"] else "does not exist"
            refuse(f"'{l}': {cap}.{n} {why}")
        if st["claims"][n][0] != m[3]:
            refuse(f"'{l}': the old text does not match {cap}.{n}, which reads \"{st['claims'][n][0]}\" - another item changed it since this spec was written")
        need_step(m, l, 4)
        st["claims"][n][0] = m[4]; st["claims"][n][2] = archive
    elif m := REM.match(l):
        cap, n = m[1], int(m[2])
        st = get(cap)
        if st is None or n not in st["claims"]:
            why = "is already removed" if st and n in st["tombs"] else "does not exist"
            refuse(f"'{l}': {cap}.{n} {why}")
        del st["claims"][n]; st["tombs"][n] = archive
    else:
        refuse(f"a line this cannot read: '{l}' - a claim needs a step (Step N), or use one of the forms in the header of lib/merge-capabilities.sh")

os.makedirs(cap_dir, exist_ok=True)
for cap, st in state.items():
    path = os.path.join(cap_dir, cap + ".md")
    with open(path + ".tmp", "w") as f:
        f.write(render(cap, st))
    os.replace(path + ".tmp", path)
print("\n".join(assigned))
PY
