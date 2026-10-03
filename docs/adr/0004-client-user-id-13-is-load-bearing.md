# The Client's upstream user id is 13, and that is load-bearing

> **Status: accepted 2026-10-02, implemented.** One sentence below has drifted: "picking a Role signs
> you in" was true of the Role picker, which `#2`'s login form replaced. Signing in is a credential form
> now, and the credentials are checked against nothing — the form's Role switch decides which hardcoded
> person you become, exactly as the picker did. Everything this ADR turns on is unchanged, which is why
> the sentence is annotated rather than rewritten.

There is no sign-in: picking a Role signs you in as a hardcoded person for that Role. The Client's
id is a real upstream user id, so their posted-jobs list is a genuine API call rather than a
fixture — and the specific id matters. The upstream dataset spreads 254 todos over 149 users, most
with one or two; id 13 has the most of anyone, six, of which two are completed. That is what gives
the Client four open Jobs and two done ones on first launch, so every status renders on a cold
install with nothing seeded.

The obvious-looking `userId: 5` returns an empty list.

## Consequences

`13` is not a placeholder and must not be tidied into a rounder number. Changing it means
re-checking the distribution against the live API first and recording what the new id yields here.
A reader who swaps it for a "nicer" value gets an empty first screen and will reasonably blame the
query layer.

The Pro's id is ours, not the API's, because the upstream data has no notion of an assignee. Pro
identity and every claim exist only in the local job store, which is why the two ids have
different shapes — the Client's is a number from the API, the Pro's is a string we made up.

The two people are deliberately different humans. The Client's job detail shows which Pro claimed
their Job, and that name reading back is the only on-screen proof that the assignment survived a
Role switch. With one name on both sides, that whole path is invisible.

The counts above are recorded from the PRD's own check of the live API, not from a fixture. They
are the first thing to re-verify if the Client's first screen ever looks wrong.
