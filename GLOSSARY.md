# Repairs

A repair-jobs app where two kinds of people share one codebase: a Client posts repair jobs, a Pro
picks them up and completes them. Both sides live in one glossary because both roles run on one
device, against one dataset, in the same app.

## Language

### The work

**Job**:
A single repair request, posted by one Client and worked by at most one Pro.
_Avoid_: task, todo, ticket, request, repair

**Job status**:
Where a Job is in its lifecycle: open, claimed or done. There are three, and nothing else is one.
_Avoid_: state, stage, phase

**Open**:
A Job no Pro holds. The only status a Job can be claimed or cancelled from.
_Avoid_: unclaimed, available, pending, new

**Claimed**:
A Job one Pro holds and has not finished.
_Avoid_: assigned, in progress, accepted

**Done**:
A Job its Pro has finished. Terminal.
_Avoid_: completed, closed, finished, complete

### The verbs

**Claim**:
A Pro taking an open Job and becoming its Pro. One Pro per Job, and only from open.
_Avoid_: assign, accept, take, pick up, grab

**Complete**:
A Pro marking a Job they hold as done. Only the Job's own Pro can.
_Avoid_: finish, close, mark complete, resolve

**Cancel**:
A Client withdrawing their own Job while it is still open. A cancelled Job is gone from every
list for good; once a Pro has claimed it, it can no longer be cancelled.
_Avoid_: delete, remove, withdraw, archive

### The people

**Client**:
The person who posts Jobs and tracks them. Never claims and never completes.
_Avoid_: customer, user, owner, poster, requester

**Pro**:
The person who claims open Jobs and completes them. Never posts.
_Avoid_: contractor, worker, tradesperson, handyman, provider, assignee, technician

**Role**:
Which of the two people you are signed in as, Client or Pro. One Role at a time, and it survives
a restart.
_Avoid_: user type, persona, account type, mode

**Role lock**:
A product shipping with its Role fixed, so signing in is a single button and the other Role is
unreachable. Repairs Client and Repairs Pro are role-locked; Repairs is not.
_Avoid_: role mode, app role, variant

### Where a Job came from

**Server job**:
A Job that exists upstream and reached us from the API. Its status and its Client are the API's;
everything else we know about it is ours.
_Avoid_: API job, remote job, real job, fetched job

**Local job**:
A Job created in this app. It exists only on this device: there is no upstream record to talk to,
so it is never sent anywhere and never fetched back.
_Avoid_: draft, offline job, fake job, in-app job

### The lists

**Posted jobs**:
The Jobs one Client posted, whatever their status. Labelled "My Jobs" on screen; in routes, hooks,
tests and issue titles, say posted jobs.
_Avoid_: my jobs, own jobs, client jobs, created jobs

**Claimed jobs**:
The Jobs one Pro holds or has finished. Also labelled "My Jobs" on screen, which is why the label
is never the name used anywhere else.
_Avoid_: my jobs, pro jobs, assigned jobs, mine

**Available jobs**:
Every open Job, from every Client. What a Pro can claim.
_Avoid_: open jobs list, job feed, all jobs, the pool

### The products

**Repairs**:
The shared app. One install, both Roles, a Role picker at sign-in and a Role switcher inside.

**Repairs Client**:
Repairs, role-locked to Client.

**Repairs Pro**:
Repairs, role-locked to Pro.
