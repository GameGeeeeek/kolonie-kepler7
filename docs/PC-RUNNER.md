# PC runner for Void and Kepler

The Windows computer SASCHANEU provides one shared execution slot for
`GameGeeeeek/void-sector` and `GameGeeeeek/kolonie-kepler7`.
The label is `pc-saschaneu`; the dedicated WSL distribution is
`Codex-GitHubRunner`. A Windows controller polls both repositories and launches
one short-lived, single-job Linux runner at a time. A process lock and a Linux
file lock prevent concurrent local jobs, including across the two repositories.
The Windows GitHub CLI credential is never copied into Linux. Linux runners
receive only a temporary JIT configuration. Each job has a fresh workspace and
home directory. Docker containers and volumes are removed after each job.

## Select GitHub when the PC is off

Open **Actions**, select the desired workflow, then **Run workflow**.
Select the branch whose code should be tested and set **runner** to **github**.
The default **pc** waits for this computer to be online and logged in.
Re-running an old run retains its old runner choice: start a new manual run
to change from PC to GitHub. An unassigned PC job fails after 24 hours.
There is no automatic paid fallback. A main Void manual GitHub run uses a
separate concurrency group so a queued PC run cannot block the emergency run.

Public fork pull requests execute on GitHub. The personal PC only accepts
queued jobs whose head repository matches one of the two approved repositories.
The controller requires labels containing `pc-saschaneu`.

Void's ARM64 production deployment and maintenance runners are unchanged.
The external health check stays on GitHub because it must work outside the
home network even when the PC is off. Small server maintenance gates and reboot
waits also stay independent of the PC. Artifacts and Packages storage retain
their own billing. Standard GitHub runners remain free for public Kepler jobs.

The old English preview is restricted to its original feature branch. That
branch must include the updated workflow before it can use the new selection.
For manually running mobile-settings checks, select that feature branch.

## Local operation

Windows task **Codex-PC-GitHub-Runner** starts after the Windows user logs in.
On its first run after the WSL installation reboot, it verifies the downloaded
Ubuntu image, installs Linux dependencies and Docker, schedules a smoke test
in both repositories, and then starts the controller. Logs are beside the
local setup scripts under `logs/`. No Windows restart is performed by setup.
Keep the local `outputs/pc-runner` folder: it contains the running setup.
Keep the existing GitHub CLI login; `gh auth login` repairs an expired login.

Pause: stop the scheduled task and its dedicated WSL distribution. Restart:
run the scheduled task again. Never terminate WSL while a job is executing
unless cancellation is intended. During a local job the controller requests
that Windows stay awake; ordinary idle power settings apply between jobs.
