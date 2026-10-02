# Prompts — writing the PRD

The prompts used to produce `PRD.md`, in order, verbatim.

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
> The ideia is to show that I have experiente to both use the same app to show to 2 different types of users, and use 2 different apps sharing the same codebase. Lets reuse the components between the single shared app and the other 2 (I dont want to recreate components for the app 2 and 3, I want to reuse the components created for app 1). Lets use native wind and react native for layout (no need for gluestack-ui). Lets keep the e2e tests with detox and integration tests with jest + react testing library (like we did in this project). I'll later move this prd to a new folder and ask another agent to execute it (no need to add this to the prd). I'll also move the turno screenshots so we can use it as reference (the app will be for a different type of user, but we can reuse the same design system, add turno design system/ most used colors to the prd)
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

> add that the commits must be made by me (no co authored by claude tags)

**8.**

> what parts you need me to validate?

**9.**

> 1 - lets keep the 3 apps, dont mind the 4 hours, dont add this "4 hours" anywhere. I dont want the other agent to try to skip things because he read that we need to do it in 4 hours
> 2 - rename it to both like you suggested
> 3 - bump to latest
> 4 - reuse turno pallete
> 5 - no need to add this conversation. but add a prompts.md to the same folder. Add the first prompt as "1 - discussed PRD with Claude Code". I'll update this one later, dont document this, just add
> 6 - in

**10.**

> how does the prd treats addings a project with client user vs loging out and signing on with the pro? Will the added repair project be shown to the pro?

**11.**

> fix it as you suggested.

**12.**

> changes the personas name to - Renato Probst (client) and Mike Sullivan (Pro)

**13.**

> what is this overlay exactly, is it what applies the content of the zustand store into the react query get?

**14.**

> yes, rename it to useLocalJobs

**15.**

> read the full prd again and check for inconsistencies

**16.**

> fix all twelve, follow the description precedent for 5-7

**17.**

> add a guidelines section. Add to it: use jsdocs for all code. Dont add unnecessary comments, only add usefull comments and prefer to not add comments (add comments to the top of all files, but only comment a function or variable if extremelly needed, if the name already implies what it does, dont add a comment)

**18.**

> move code guidelines to the beginning

**19.**

> save all the prompts used here to a second prompts file, called prompts-PRD.md . Dont add anything about this to the PRD
