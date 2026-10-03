# Prompts Sum up

## Prompts — writing the PRD

The prompts used to produce `PRD.md`, in order. It was run from an agent inside this other project where I created a copy of Turno Hosts app (because it already had most the architecture, libraries, colors, and design system I needed for this task, so I would like to reuse it): https://github.com/sagits/sweep-public

---

**1.**

> read about why this project was made and how it was made (archtectures)

**2.**

> this was made because I'm taking part in a job interview at turno (so I cloned their app in order to show that I can work on what they do). I also took all the archtectural decions, screenshots, videos, etc to shown like I will work day to day on their company (i did this based on their company needs, and how i think we should system design their apps based on their product).
>
> I'm on another step of their interview process and I need to do the create the app on this pdf. Help me write a new prd file (very similar to the first one, we will use the same stack apart from the API and the necessary changes to fit the narrative of this new app). Lets keep using react-native-web so we can also share this on a website at vercel later. keep using the monorepo, lets have 3 apps:
> 1 - single shared app for both the client and pro
> 2 - pro app
> 3 - client app
>
> The ideia is to show that I have experience in both using the same app to show to 2 different types of users, and using 2 different apps sharing the same codebase. Lets reuse the components between the single shared app and the other 2 (I dont want to recreate components for the app 2 and 3, I want to reuse the components created for app 1). Lets use native wind and react native for layout (no need for gluestack-ui). Lets keep the e2e tests with detox and integration tests with jest + react testing library (like we did in this project). I'll later move this prd to a new folder and ask another agent to execute it (no need to add this to the prd). I'll also move the turno screenshots so we can use it as reference (the app will be for a different type of user, but we can reuse the same design system, add turno design system/ most used colors to the prd)
>
> `Mobile Take-Home — Repair Jobs App.pdf`

**3.** *(answer to a multiple-choice question about the product name and the data layer)*

> Product name: **Repairs (plain)** — "No branding exercise at all. Lets the reviewer focus on architecture, not naming."
>
> Data layer: deferred for clarification.

**4.**

> lets use tanstack query for the requests (and its own cache) and zustand to save the user data and any other data we need to zustand stores (local data, user data, forms data, anything we cant just save from API as it is)

**5.**

> lets use both tanstack query + zustand. tanstack query for all requests. Once we succefully POST/PUT we save data to a local zustand store, update tanstack local cache, and next time tanstack makes a GET query we use zustand to populate the saved POST data from the local store into the tanstack response (check the best way to do this, I basically want the app to use tanstack without having to think about these POST requests all the time, just like an app calling a normal API would, I centain that tan stak query has some kind of change we can do before it returns data to the user, so we can create custom useQuery hooks that will return the GET data appended with our store saved data)

**6.**

> add react hook form and zod for forms


**7.**

> add a guidelines section. Add to it: use jsdocs for all code. Dont add unnecessary comments, only add usefull comments and prefer to not add comments (add comments to the top of all files, but only comment a function or variable if extremelly needed, if the name already implies what it does, dont add a comment)

**8.**

> move code guidelines to the beginning

**9.**

> save all the prompts used here to a second prompts file, called prompts-PRD.md . Dont add anything about this to the PRD

---

1. Defined a PRD.md after 2 hours of discussion with Claude based on my experience. I decided on the best practices, like using TDD with Jest, E2E with Detox, the libraries I usually use (React Query, Zustand, React Hook Form, Zod, Native Wind), and defining a monorepo structure so we can reuse code
2. Used Matt Pocock skills to turn the PRD.md into issues/tickets inside the Github repo
3. Used Matt Pocock skills to implement the tickets, manually validated the outcome, and helped the agent fix any architectural errors like configuring detox, configuring jest, defining parallelism strategies to work on multiple tickets at once using git worktree

## Planning the spec

1. Discussed PRD with Claude Code (see "Prompts — writing the PRD" above)
2. `/ask-matt I want to build whats in @PRD.md, what skills should I use?` — picked the route through
   the skills. The PRD is already a spec, so the answer was to skip the grilling and the spec step and
   merge in near the bottom: domain docs, then tickets, then build.
3. `/domain-modeling @PRD.md` — wrote `GLOSSARY.md` and ADRs 0001 and 0002. These are part of Matt Pocock skills, it saves some words used on the PRD so the implementation agents understand what a Client user and a Pro user means.
4. `/to-tickets @PRD.md` — broke the PRD into multiple tickets and asked me to review and I'm satisfied on the number of tickets, which tickets block each other, which can be worked on parallel on a git worktree, and the order they could be worked on. Then generate an issue on github for every ticket

## Building it


5. `/implement #1` to implement the ticket that will create the project template (turbo monorepo with detox and one mobile app called both)
6. `/implement #5` Theorically we could implement #2, #3, #4 first, but #5 is the detox installation that I prefer to do in advance (because installing and running detox on the simulator can break very easily and its difficult to install)
7. `/implement-spec`, with no argument — the spec being `PRD.md` and the tickets being the sixteen
    GitHub issues. One integration branch, `spec/repairs-mvp`, for the whole run, with a throwaway
    branch per ticket under it.
8. `don't implement #14 and #15 now`. Those are the tickets I left to a nother version, but decided to do then today
9. `Make the login screen similar to this picture with e-mail ,password and a switch for user type`. Sent a picture from a login screen of an iOS app I found on Google because originally the agents developed only two buttons to change between Pro and Client user
10. `/implement #14` - on one agent, and  `/implement #15 on a git worktree` on another agent. I decided to implement these 2 as a follow up. #14 adds 2 more apps that share the same layout and logic: client app, and pro app. The ideia is to show how can we share code and components on a monorepo. #15 add web support. As I decided to use react-native-web, the idea was to show that we can also turn this app into a website (with almost the same layout) and use the same code and components on it.
