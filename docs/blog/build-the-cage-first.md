
Two of Simon Wardley's predictions have sat on my map for years: that serverless
was the next evolution of devops, and that conversational programming was the
one after it. Both came true — the first quietly, the second all at once.

I wanted to write about the evolution of serverless for a long time, but I never
found the hook. I had gone looking for it and was underwhelmed. Serverless was
real, but adoption stayed narrow, finding use in glue functions and cron jobs,
but in nothing like the platform shift the map implied. The most interesting
thing I read in those years was
[Erik Bernhardsson's](https://www.latent.space/p/modal) account of building
Modal. They threw Docker out and wrote their own container runtime and a
lazy-loading filesystem in Rust, for Python only, because general-purpose
containers were simply too slow to feel serverless. As inference and training
costs climbed, _serverless GPU_ finally started to make sense, where you pay by
the second and scale to zero, because an idle H100 is a fortune.

Then the second prediction landed and made the first one matter. Conversational
programming stopped being a forecast and became how I work. And when I looked at
what was actually under the boring, CPU side of serverless — under AWS Lambda,
under Fargate, under [System Initiative's](https://github.com/systeminit/si)
function execution — it was the same engine every time:
[Firecracker](https://github.com/firecracker-microvm/firecracker/blob/main/docs/design.md).
A microVM AWS built to run strangers' code, at Lambda scale, without those
strangers reaching the host or each other.

Firecracker is deliberately tiny. No GPU passthrough, barely any devices —
[a handful of virtio interfaces](https://github.com/firecracker-microvm/firecracker/discussions/4845)
and nothing else. For the GPU crowd that is a dealbreaker; you go to Cloud
Hypervisor instead. But I did not need a GPU. I needed a box I could trust
around code I did not write, and Firecracker's whole minimalism _is_ the
security story. The thing that made serverless safe was about to become the
thing that makes agents safe. That was the hook.

## The reason

The problem began with a question about my own work. I already run my
engineering through a state machine. It is my own flavour of
[`issue-lifecycle`](https://swamp-club.com/extensions/@magistr/issue-lifecycle),
built on Paul Stack's Booking talk and swamp-club's own version, then extended
with DDD, TDD, BDD, and planning loops. It works. Claude researches and plans, I
review and correct the plan, and it implements against tests. I built a whole
project, resinsim, from the ground up that way. A nice second-order effect is
that the repo ends up holding more than code: it contains the methodologies, the
architecture decisions, the patterns and antipatterns found while Claude worked
the tasks, and a set of UAT/BDD scenarios that pin the app's behaviour. The
process writes its own knowledge base.

It needs my hand on the wheel, however, for every plan and every correction. The
question would not leave me alone: what if the principles and the tests are
_good enough_ that I could throw a task at it and walk away? The whole
foundation already exists, co-designed in `issue-lifecycle`. So I asked Claude
to design
[`swamp-go-brr`](https://swamp-club.com/extensions/@magistr/swamp-go-brr), which
is the same lifecycle with the human taken out of the execution loop. Not Gas
Town: I did not want a swarm of built-in agents improvising
non-deterministically. I wanted the orchestration to be deterministic and living
in swamp, with the agent only filling in the leaves.

The plan that came back had a requirement I could not argue with: **isolation**.
An autonomous loop that web-searches test harnesses and runs untrusted code, on
my machine, with my credentials, is Simon Willison's
[lethal trifecta](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)
with the safety off. It is private data, untrusted content, and a way out, all
at once. It is remote code execution by design. So I paused work on the brain
and went to build the body it would need. A microVM is a hardware-isolated blast
radius for an agent you have let off the leash. **Build the cage first.**

## Where the cage drew blood

I built both extensions from zero: the microVM lifecycle and the host↔guest
control plane. The interesting part, and the part worth a post, is everything
that fought me.

**The rootfs.** The guest started as Alpine/musl, and musl fought back with
missing CA certs and BusyBox quirks. It also fought back over a `claude` binary
that is glibc-only and did not want to live there. I gave up and rebuilt the
rootfs with `debootstrap --variant=minbase` on Ubuntu, layering in the glibc
`claude-linux-x64` binary and the few tools the agent needs. It was a
rediscovery of the first lesson of serverless: stop fighting the general-purpose
userland and specialise the image.

**The kernel that wouldn't give me randomness.** TLS inside the guest just hung.
Every Claude API call needs a TLS handshake, every handshake needs random bytes,
and the legacy 4.14 `vmlinux`'s old `crng`/`getrandom()` behaviour _blocked_ on
entropy at boot. A fresh microVM has no entropy pool. The fix took three belts:
a modern CI kernel (`vmlinux 6.1.128`), the PID-1 agent manually seeding 64
bytes from `/dev/urandom` into `/dev/random` via `RNDADDENTROPY`, and a
virtio-rng device wired in before boot. A footnote that cost real time is that
if you change the kernel, you must re-bake the snapshot.

**The agent is the init system.** There is no point booting systemd in a VM that
lives for one task, so the kernel boots straight into `init=/opt/fc-agent.sh`.
The agent runs as PID 1 and never exits. It mounts its own pseudo-filesystems,
brings up the NIC, and seeds that entropy. Then it does the thing I did not see
coming: it syncs the clock by reading the `Date:` header off the task server
with `curl -I`. A microVM has no RTC, so it boots in 1970, and a clock in 1970
fails TLS certificate validation before it can even complain about entropy. Then
it polls for work. There was one last indignity: `claude --print` _hangs_ on a
permission prompt and refuses `--dangerously-skip-permissions` as root, unless
you set `IS_SANDBOX=1`. This is fair. The microVM **is** the sandbox; I just had
to say so.

**The concurrency fork, where I was confidently wrong.** The moment you want a
second agent, the baked-in guest address (`172.16.0.2`) collides. My instinct
was to de-bake it and pass the address in on the kernel command line. A review
killed that idea as fundamental: the cmdline is read once at boot, and the
workflow does not boot, it _restores from a warm snapshot_ — a frozen image
whose network state is already in memory. My fix was inert on the exact path
that makes the thing fast. The right answer, from Firecracker's own "network for
clones" recipe, is the opposite of my instinct. You do not re-address the guest;
you _isolate_ it. You keep it byte-identical and wrap each clone in its own
network namespace, with its own TAP, a veth pair, and a double MASQUERADE. This
way, one base snapshot restores into N identical clones that cannot see each
other. I enjoyed one detail: Linux caps interface names at 15 characters, so the
root-side veth name has to be hashed from the namespace or two clones collide on
the name instead of the IP.

**The bug I caught before it bit.** This is the one I am proud of. A network
namespace isolates the _network_, but it does not isolate `/tmp`. The
control-plane server keyed its files by `tapPort`, which is hardcoded to 8080 in
every guest. This meant that six concurrent VMs would all share
`/tmp/fc-task-8080.json` on the host. A task injected for one could be served to
another, and results would clobber each other. The netns had fixed the IP
overlap and left a file overlap one layer down. The fix is a two-line key,
`netns-tapPort`, but the lesson is that "isolated" is always isolated _along
some axis_, and you have to name the axis.

The rest of the issues were small traps, which I will cover briefly. The vsock
throws an "address in use" error when you restore concurrent VMs from one
snapshot because of stale sockets and a baked-in path, which requires a per-VM
override and cleanup. You cannot tear a VM down with `pkill firecracker` once a
second one exists, so a PID sidecar gives you a precision kill. Tearing down a
namespace leaves the host's NAT rules behind unless you tag each with a comment
and flush by it. None of these issues are hard. They are all invisible until the
second VM exists, and then they arrive at once.

The working shape is a 6.1 kernel and a 512 MiB / 2-vCPU guest that costs ~45
MiB of host RAM. It is booted once and frozen into a warm snapshot so a restore
is sub-second. Firecracker's own people quote 150 microVMs a second per host.
The `wait_serial` command watches the serial console for the agent printing
`worker ready; polling for tasks` before it bakes the snapshot. That is how you
know what is inside is alive before you freeze it.

## The token

The agent in the guest runs `claude -p` with my `CLAUDE_CODE_OAUTH_TOKEN`, and
that is within terms. The token is scoped to Claude Code, and Claude Code is
exactly what it is running, on my own work, inside a sandbox. The control plane
injects it only at serve time on `GET /task` (it validates the `sk-ant…`
prefix), never writes it to the guest's disk, and the guest reaches
`api.anthropic.com` directly over its TAP interface and host NAT. Nothing
proxies it and nothing stores it.

## The cage, with something in it

Then I un-paused the brain and pointed the whole stack at a real task:
`/swamp-go-brr create a swamp extension to self-host a Bluesky PDS and post to it, deployed to Unraid via docker-compose`.

Opus 4.8 was the conductor. It read the goal, decomposed it into a DAG of
file-disjoint tasks, and `gobrr` — the deterministic state machine — only
validated and scheduled them. It refuses a bad decomposition rather than
improvise one. The `fabric_up` command brought up five warm microVMs in five
network namespaces. Round one consisted of four libraries, built in parallel,
each in its own VM, and each just a `claude -p` with a crafted work-order. The
host never ran a line of the agent's code. It parsed the returned diffs and
applied them behind an allowlist, because of the isolation invariant that code
is only ever _authored_ inside a VM. Then it gated each change in a
`--network none`, read-only container. Two passed on the first try. Two bounced
on a type error and a wrong field name, and passed on the retry. I rebased the
green ones into a stack, advanced the base, embedded the exact export signatures
into round two's prompts so the imports would resolve, and built the two swamp
models on top. When assembled, it had 51 tests, zero failures, and a clean
`swamp extension push --dry-run`.

My total input across roughly fourteen hours was the kickoff, one interrupt, one
"continue", and one approval. It built `@magistr/bluesky-pds` end to end. I have
_not_ published it, as there has been no adversarial-review pass on it yet, and
that judgement is still mine. The cage works; deciding what is allowed out of it
does not.

The tuning to get there was its own set of small cruelties, which is why this
became two posts. The verify gate runs with `--network none`, so you need a
digest-pinned, fully-offline deno toolchain image baked ahead of time. The
`--no-lock` flag is mandatory or deno tries to write `deno.lock` into the
read-only tree and dies. You must read the result from `dv current`, not
`dv result`, or every task reports `exitCode: null` and the loop politely
ignores all of them. And because every task branches off one fixed base,
anything importing a sibling's brand-new file fails its isolated gate. So you do
the independent pieces first, rebase, advance the base, and only then seed the
dependent round.

## Back to the map

There is nothing surprising about an agent running on a microVM. That is just
how value chains work: the novel thing at the top of the stack rides on the
boring, industrialised thing at the bottom, and the more commoditised the bottom
gets, the more freely the top can move. Autonomous agents are the new
capability, and hardware-isolated microVMs are the utility underneath. The only
detail worth noticing is _which_ utility they landed on — the same stripped-down
box AWS built to run Lambda, doing a second job nobody scoped it for.

I built the cage first because autonomy without a blast radius is not autonomy;
it is a liability. The next post will cover what I put in it: `swamp-go-brr`,
the brain.
