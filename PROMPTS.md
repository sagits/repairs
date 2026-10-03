# Prompts Sum up

1. Defined a PRD.md after 2 hours of discussion with Claude based on my experience. I decided on the best practices, like using TDD with Jest, E2E with Detox, the libraries I usually use (React Query, Zustand, React Hook Form, Zod, Native Wind), and defining a monorepo structure so we can reuse code
2. Used Matt Pocock skills to turn the PRD.md into issues/tickets inside the Github repo
3. Used Matt Pocock skills to implement the tickets, manually validated the outcome, and helped the agent fix any architectural errors like configuring detox, configuring jest, defining parallelism strategies to work on multiple tickets at once using git worktree

## Planning the spec

1. Discussed PRD with Claude Code (see @Prompts-PRD.md)
2. `/ask-matt I want to build whats in @PRD.md, what skills should I use?` — picked the route through
   the skills. The PRD is already a spec, so the answer was to skip the grilling and the spec step and
   merge in near the bottom: domain docs, then tickets, then build.
3. `/domain-modeling @PRD.md` — wrote `GLOSSARY.md` and ADRs 0001 and 0002. Three terms the PRD left
   overloaded came back as questions, and I settled them: cancelling is erasure rather than a fourth
   status, a claim record outlives the claim it records, and the two lists both labelled "My Jobs" get
   distinct names everywhere except the screen.
4. "write both of those ADRs too" — ADR 0003 (three apps, parity enforced by a script) and ADR 0004
   (why the Client's upstream user id is 13 and must not be tidied).
5. `/to-tickets @PRD.md` — broke the PRD into tracer-bullet tickets with blocking edges.
6. "split the data layer out of 06" — the Client's list ticket was carrying the API boundary, the
   mapping, the overlay and a screen with five states. Split the data layer out as its own ticket,
   verifiable by its tests alone, and left the overlay module whole inside it.
7. "go" — published the 16 tickets to GitHub with native dependency edges.
8. `/ask-matt does implement and implement-spec creates one branch per feature?` — neither does.
   `/implement` commits to the current branch; `/implement-spec` runs one integration branch for the
   whole spec with throwaway per-ticket branches underneath. Noted that per-ticket `/implement` on a
   linear branch suits this repo better, since the commit history is part of what gets reviewed and a
   graph of sixteen merges reads worse than a series of small commits.
9. "save the prompts I used to @PROMPTS.md" — this file.

## Building it

Everything from here is the `/implement-spec` run, on 2026-10-02 into 2026-10-03. Most of it is about
the two things that actually decided how long the build took: the Detox harness, and which tickets ran
together.

10. `/implement-spec`, with no argument — the spec being `PRD.md` and the tickets being the sixteen
    GitHub issues. One integration branch, `spec/repairs-mvp`, for the whole run, with a throwaway
    branch per ticket under it.
11. Two setup questions, both answered in a way the rest of the run then depended on. **Detox tickets
    run in the main checkout** rather than one worktree each: `apps/both/ios` is a 6.2 GB gitignored
    native build, `scripts/e2e-test.sh` hardcodes Metro on `:8081`, and there is one simulator — so
    per-ticket worktrees would have cost something like 68 GB and two hours of rebuilds to buy
    concurrency the hardware cannot deliver anyway. And **an agent that hits a red spec fixes it
    itself** instead of stopping to be watched: "I will not be looking to the screen all the time to
    see your tests."
12. "would headless detox be faster to test?" — no, and `DECISIONS.md` had already measured it. The
    useful part was what the question flushed out: the cost in a Detox run is Metro's cold bundle, not
    the flag.
13. "keep metro warm between detox runs. use detox test --reuse, only reinstall the app if you really
    need it." The harness this produced is what every later ticket ran on.
14. "is anything else slowing us down on each implementation that we can change and will not affect
    overall quality?" — four harness changes, one of which turned out to be built on a false premise:
    `delete: true` was assumed to be the suite's most expensive operation and measured at about 0.6s,
    so the reset-by-link that replaced it made the suite slightly *slower*. It was kept anyway, with
    the measurement written down beside it, because it says what it means rather than achieving it by
    side effect.
15. "do your recommendation" — including the install stamp, which records which binary was installed
    so that `--reuse` cannot silently test stale native code.
16. "keep it and start #8" — the reset link stays despite the measurement, because it is documented
    honestly and a negative check proved it load-bearing where it is used.
17. Asked what skipping the two role-locked apps would save, then the web build, then: "i want to keep
    all tickets, forget about removing any of them. Lets discuss ideas to speed development time,
    maybe parallelism." The honest answer was that the critical path was the wall, not the lack of
    parallelism — most of the remaining tickets needed the one simulator.
18. "do all 5, batch the tickets you think make sense and will speed things up."
19. "can we do 10, 11, 12 on the same agent?" — yes, and it was the better batch: #11 has no spec of
    its own, and all three are one design around the claim record. Then "can we also do #9 along with
    #10, #11, #12?" and, once the numbers were on the table, "ok keep #9 separate" — four tickets
    would have outgrown the context window, and compaction is exactly where a batch loses the shared
    context that made it worth batching.
20. "lets also not do #13, we will leave it for the future", then "skip #14 too". Both deferred rather
    than cancelled: commented on the issues, left open, unblocked from the docs ticket, with nothing
    built and nothing deleted. The README names both as gaps.
21. "keep it as it is, dont add anything new" — declining a guard that would have stopped
    `e2e-test.sh` reusing a Metro belonging to a different worktree. A hazard that had not happened
    did not earn code.
22. "can you spawn a subagent to merge what we already have commited to main and keep working on this
    feature/spec branch? Also add a small readme explaining the project and how to run (what we
    already have working, dont talk about what we dont have)" — `main` was fast-forwarded mid-run and
    got a deliberately partial README, covering the Client side only. This one extends it.
23. "spawn a subagent to push main" — done directly instead, being one command that touches no working
    tree.

Made the necessary changes to README, asked the agent to add a Login screen with e-mail, password, and user type switch (and add the necessary tests)
