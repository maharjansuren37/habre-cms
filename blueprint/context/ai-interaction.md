# AI Interaction

> **Yours to edit.** How the AI should work with you on this project.

## Communication

- Lead with the answer. Context after, if it is needed at all.
- Short, scannable markdown: lists for enumerations, a table for a comparison.
  Long prose blocks get skimmed and then missed.
- Say "I don't know" or "I couldn't verify that" instead of producing a
  confident guess. A wrong confident answer costs more than a question.
- No preamble, no restating the request back, no summarising what you are about
  to do before doing it.

## Explaining code

The point of this loop is that you understand the code at the end of it, not
just that it exists. So:

- Every change comes with a plain-English explanation: what it does, why this
  way.
- One line per changed file beats a paragraph about the change as a whole.
- Diffs, not whole files.
- If an explanation would not let you defend the change to someone else, it was
  not a good enough explanation. Ask for a deeper one.

## Approval

- Nothing is committed that you have not seen and approved.
- Merging is a separate yes from building. Pushing is a separate yes from
  merging. Deploying is a separate yes again.
- "Looks good" on a diff is not permission to push.

## When stuck

After two failed attempts at the same thing, stop and say so rather than trying
a third variation. Report what was tried, what happened, and what the options
are. Thrashing costs more than asking.

## Scope

- Do what was asked. Not the adjacent thing that also looks broken - mention
  that instead, and let it be a decision.
- If the spec is wrong, stop and fix the spec. Do not improvise past it.
- Refactoring is its own item, never a passenger on someone else's diff.
