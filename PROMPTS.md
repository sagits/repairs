# Prompts

The prompts used while building this, in order.

1. Discussed PRD with Claude Code (see @Prompts-PRD.md)
2. `/ask-matt I want to build whats in @PRD.md, what skills should I use?` — picked the route through
   the skills. The PRD is already a spec, so the answer was to skip the grilling and the spec step and
   merge in near the bottom: domain docs, then tickets, then build.
3. `/research` — fired at the version table, then cancelled before it ran. The SDK and library versions
   in the PRD are still as-written, unverified.
4. `/domain-modeling @PRD.md` — wrote `GLOSSARY.md` and ADRs 0001 and 0002. Three terms the PRD left
   overloaded came back as questions, and I settled them: cancelling is erasure rather than a fourth
   status, a claim record outlives the claim it records, and the two lists both labelled "My Jobs" get
   distinct names everywhere except the screen.
5. "write both of those ADRs too" — ADR 0003 (three apps, parity enforced by a script) and ADR 0004
   (why the Client's upstream user id is 13 and must not be tidied).
6. `/to-tickets @PRD.md` — broke the PRD into tracer-bullet tickets with blocking edges.
7. "split the data layer out of 06" — the Client's list ticket was carrying the API boundary, the
   mapping, the overlay and a screen with five states. Split the data layer out as its own ticket,
   verifiable by its tests alone, and left the overlay module whole inside it.
8. "go" — published the 16 tickets to GitHub with native dependency edges.
9. `/ask-matt does implement and implement-spec creates one branch per feature?` — neither does.
   `/implement` commits to the current branch; `/implement-spec` runs one integration branch for the
   whole spec with throwaway per-ticket branches underneath. Noted that per-ticket `/implement` on a
   linear branch suits this repo better, since the commit history is part of what gets reviewed and a
   graph of sixteen merges reads worse than a series of small commits.
10. "save the prompts I used to @PROMPTS.md" — this file.
