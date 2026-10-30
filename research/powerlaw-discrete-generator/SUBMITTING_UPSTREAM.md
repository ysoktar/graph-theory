# Submitting the powerlaw fixes upstream

This guide takes the two local fixes to [powerlaw-devs/powerlaw](https://github.com/powerlaw-devs/powerlaw) as **two issues
and one pull request with two commits**. You open all of them yourself, from your own account and your own machine.

| Commit | Fixes | Patch |
|---|---|---|
| 1 | A: discrete sampling bias | `upstream-fix-a/0001-Fix-discrete-random-generation-exact-integer-inverse.patch` |
| 2 | B: hang outside `parameter_ranges` | `upstream-fix-b/on-top-of-fix-a/0001-Raise-instead-of-hanging-when-generating-discrete-da.patch` |

`upstream-fix-b/0001-…patch` (B applied directly to master) is only needed for the two-PR route in the appendix.

## 1. Why one PR, and why two issues

**One PR with two commits:**

- **No conflicts.** Both fixes touch `_double_search_discrete`. As separate PRs, whichever is merged second would
  need a rebase, and the maintainers would review the same function twice.
- **Less review time.** Two people answer PRs there, and the open PR #110 has waited since September 2025. One PR
  means one review and one CI run.
- **Already tested together.** All 18 new tests pass on the combination, and so does the full suite (75 passed).
- **Still separable.** Each commit has its own tests and message, so the reviewers can read them one at a time.

**Two issues:** they are different bugs (wrong results against a hang). Issue B carries a policy question for the
maintainers that issue A does not have.

**The one risk:** the policy discussion on B could hold up A, which is a plain bug. The PR body below handles this:
it says commit 2 can be dropped or changed without touching commit 1.

## 2. Are AI-assisted contributions allowed?

**What I found (checked 29 October 2026):**

- The project has no rule about AI or LLM tools.
- There is no `CONTRIBUTING` file, code of conduct, or issue or PR template. The repository's `.github/` contains only
  `workflows/`, and the organisation has no `.github` repository (404).
- The README only says that pull requests are welcome and that `python -m pytest testing/ -v` should pass.
- One open PR, #110, says "With the help of AI…" in a comment. Neither maintainer who replied mentioned it; they
  discussed the mathematics.
- GitHub's Terms of Service, section B.3, require a human account: "Accounts registered by 'bots' or other automated
  methods are not permitted." They also allow one free machine account per person for automated tasks. Nothing in the
  sections that were read forbids a person from submitting AI-assisted work from their own account. The owner of
  the account is responsible for what it posts.

**What that means:** you may submit this, but you are its author in every sense the maintainers care about. Before
you post, you should be able to explain every line of the diff and answer review questions without me.

**What I recommend, to stay honest:**

1. **Open everything yourself** in the GitHub web interface, and push from your own machine. Don't let an agent
   post on the project.
2. **Disclose the assistance once in each issue and in the PR**, in one plain paragraph, for example:
   > The analysis, patch and tests were prepared with the help of an AI coding assistant (Claude). I have reviewed
   > the diff, rerun the tests listed below on my machine, and checked the numbers against an independent
   > Hurwitz-zeta calculation.

   Only write the second sentence once it is true.
3. **Rerun the evidence yourself** (step 4) and replace my environment lines (Python 3.13.17, NumPy 2.5.4,
   SciPy 1.18.1, Linux) with yours.
4. **Don't claim anything that hasn't been checked.** CI has not run yet; it runs when the PR is opened. Say so until
   it has run.

## 3. What has been checked, and by whom

| Claim in the drafts | Status |
|---|---|
| u = 0.30, α = 2.5, `xmin` = 5 gives 5; the exact answer is 6 (P(X ≥ 6) = 0.7419) | rerun by me on a clean powerlaw 2.0.0 |
| Masses for k = 3…10 at `xmin = 3`: 0.319, 0.293, 0.076, 0.054, 0.071, … (exact 0.389, 0.190, 0.109, …) | rerun by me on 2.0.0 |
| 14–16% of quantiles land on the wrong integer for `xmin` = 3, 5, 6, 10, 20 (α = 1.8 and 2.5); 0% for `xmin` = 1, 2 | rerun by me on 2.0.0 (4,000-point quantile grid) |
| Approximate path P(K = xmin): 0.0741 / 0.0373 / 0.0150 (2.0.0) against 0.1391 / 0.0722 / 0.0296 (exact) for `xmin` = 10 / 20 / 50; with floor 0.1394 / 0.0723 / 0.0296 | rerun by me on 2.0.0 |
| Clauset et al. (2009): approximation Eq. (D.6) uses floor; exact method Eq. (D.5) narrows to k ≤ x < k + 1 | read in arXiv:0706.1062v2, Appendix D, pp. 39–40 |
| PMF–CCDF identity table per family (`identity.py`) | rerun by me on 2.0.0: identical numbers |
| Truncated power law α = 1.5, λ = 1e-3: P(K = 1) = 0.310 for master and fix, 0.399 for the discrete PMF (`tpl_grid.py`) | rerun by me |
| The same case with rounding gives 0.194 | computed once by the fix-A analysis; **not rerun**. Rerun it or leave it out |
| RED: commit 1's new tests fail 9 of 10 on master; commit 2's new tests fail 4 of 7 on master | from the saved logs |
| GREEN: 18 new tests pass with both commits | rerun by me on the final patches |
| Full suite: master 57, fix A 68, fix B 64, A + B 75 passed, 0 failed | from the saved logs. The A + B run used the same code as the final patches; only comments and commit messages changed afterwards |
| The two patches apply cleanly in order to upstream master `d2b563a`; author reset by the rebase in step 4 | checked by me on a scratch clone |
| `mpmath` (used by the new tests) is a declared dependency; the code is valid Python 3.8 | checked by me |
| Bootstrap p-value of E. coli metabolism: 0.963 with powerlaw's generator, 0.113 with an exact sampler | from the earlier analysis in this folder (`FINDINGS.md`); fine as context, not needed for the issues |
| Behaviour on Windows, on macOS and on Python 3.8–3.12 | **not checked**; CI will show it |

## 4. Commands

On your own computer, with Git and Python 3.8 or newer installed.

### 4.1 Fork and clone

1. Open <https://github.com/powerlaw-devs/powerlaw> and click **Fork**. This creates `github.com/<you>/powerlaw`.
2. Clone it and set your identity:

```sh
git clone https://github.com/<you>/powerlaw.git
cd powerlaw
git remote add upstream https://github.com/powerlaw-devs/powerlaw.git
git fetch upstream
git config user.name "Your Name"
git config user.email "you@example.com"      # use the email of your GitHub account
```

### 4.2 Get the patches

Download the two patch files listed at the top from this repository's `research/powerlaw-discrete-generator/` folder,
from GitHub or from a clone of graph-theory. Put them in `~/patches/` and keep their file names.

### 4.3 Environment and baseline

```sh
python -m venv .venv
source .venv/bin/activate          # Windows PowerShell: .\.venv\Scripts\Activate.ps1
python -m pip install -U pip
python -m pip install -e . pytest
python -m pytest testing -q        # about 7–12 minutes; on master: 57 passed
```

### 4.4 The branch with both commits

```sh
git switch -c fix/discrete-generation upstream/master
git am ~/patches/0001-Fix-discrete-random-generation-exact-integer-inverse.patch
git am ~/patches/on-top-of-fix-a/0001-Raise-instead-of-hanging-when-generating-discrete-da.patch
# The patches carry a placeholder author; this makes you the author of both commits:
git rebase --exec "git commit --amend --reset-author --no-edit" upstream/master
git log --format='%h %an <%ae> %s' -2      # check: your name on both commits
python -m pytest testing/test_discrete_generation.py testing/test_generation_out_of_range.py -q   # 18 passed
python -m pytest testing -q                                                                      # 75 passed
git push -u origin fix/discrete-generation
```

To see RED yourself, check out master's `powerlaw/distributions.py` and run the new tests. 9 of the original 10 tests of
commit 1 should fail, and 4 of the 7 of commit 2. The hang tests time out after 30 s each, so this takes a couple of
minutes. Then restore your version:

```sh
git checkout upstream/master -- powerlaw/distributions.py
python -m pytest testing/test_discrete_generation.py testing/test_generation_out_of_range.py -q
git checkout HEAD -- powerlaw/distributions.py
```

## 5. On GitHub

### 5.1 Two issues first

1. Search the issues once more for `generate_random`, `discrete` and `hang`. The last search found nothing, but
   someone may have filed something since.
2. Open **issue A** with the "Draft issue" in `upstream-fix-a/REPORT.md`. Add your environment and the disclosure
   paragraph.
3. Open **issue B** with the "Draft issue" in `upstream-fix-b/REPORT.md`. It asks the maintainers two questions:
   - Should `parameter_ranges` constrain only fitting, or also generation?
   - Should α = 3 be inside the range?

### 5.2 One draft PR

1. On your fork, GitHub offers **Compare & pull request** for the pushed branch. The base must be
   `powerlaw-devs/powerlaw`, branch `master`.
2. Paste the body below, fill in the two issue numbers and your own test output, and choose
   **Create draft pull request**.
3. Wait for CI (Ubuntu with Python 3.8–3.12, Windows, macOS). If a job fails, fix it on the branch and push again
   before choosing **Ready for review**.

### 5.3 PR body

```markdown
**Title:** Fix discrete random generation: exact integer inverse, floor in the estimate, no hang outside parameter_ranges

Fixes #<issue A>. Refs #<issue B>.

This PR has two independent commits. They are in one PR because both touch `_double_search_discrete`.

## Commit 1: discrete sampling (Fixes #<issue A>)

**Problem.**
- `_double_search_discrete` bisects a continuous interpolation of the CCDF to a tolerance of 0.5 and truncates the
  result. That is exact only when `xmin` is a power of two: for `xmin` = 3, 5, 6, 10 and 20, 14–16% of quantiles land
  on the wrong integer.
- `_generate_random_discrete_estimate` applies `np.around` to a value that already includes the +½ of Clauset et
  al. (2009), Eq. (D.6), so it rounds twice and roughly halves P(K = xmin): 0.074 instead of 0.139 for α = 2.5,
  `xmin` = 10.

**Change.**
- An integer inverse search on the distribution's own `ccdf` (doubling, then integer bisection): the procedure of
  Eq. (D.5), narrowed down to k ≤ x < k + 1. It is clipped at `xmax`; u = 0 returns `xmin`; a non-integer `xmin`
  raises a clear `ValueError`.
- `np.floor` in `_generate_random_discrete_estimate`, with the `xmax` bound adjusted to the new step function.
- `testing/test_discrete_generation.py`: deterministic quantile grids against an independent Hurwitz-zeta oracle
  (mpmath).

## Commit 2: no hang outside `parameter_ranges` (Refs #<issue B>)

**Problem.** Outside `parameter_ranges`, `cdf()` returns about 0 for every x, so the exact discrete generator never
terminates. With the default range (0, 3) this affects every hand-built discrete power law with α ≥ 3, including
α = 3.

**Change.**
- `generate_random` checks `in_range()` once, in the exact discrete branch, and raises a `ValueError` that names the
  parameter, its value and the range, and suggests `parameter_ranges=...`.
- `testing/test_generation_out_of_range.py`: calls that could hang run in a subprocess with a timeout, so a
  regression fails instead of hanging the suite.

Commit 2 is the minimal fail-fast guard. If you prefer another policy for #<issue B>, for example letting generation
ignore `parameter_ranges`, I can drop or change it without touching commit 1.

## Test evidence

- RED on master: 9 of commit 1's 10 original tests fail; 4 of commit 2's 7 fail (three of them by timeout).
- GREEN: `python -m pytest testing/test_discrete_generation.py testing/test_generation_out_of_range.py -q` gives
  <your output, expected 18 passed>.
- Full suite: `python -m pytest testing -q` gives <your output, expected 75 passed>; master gives 57 passed.
- Environment: <your Python, NumPy, SciPy, OS>.
- CI: see the checks below.

## Scope and non-goals

- No correctness claim for the truncated power law, stretched exponential and lognormal. Their `ccdf` differs from
  their own discrete PMF by 0.6–2.2%. That predates this PR; I can open a separate issue.
- The support disagreement at `xmax` (the PMF includes `xmax`, the CDF does not) is unchanged.
- Not fixed: α ≤ 1 without `xmax`, values beyond 2^63 in the `int64` output, and a non-integer `xmin` from a discrete
  `Fit`.
- I have not tested this against open PR #110, which also changes CDF code.

<disclosure paragraph>
```

### 5.4 While waiting for review

- Answer review comments yourself. If you use an assistant to draft a reply, check every factual statement in it
  first.
- If the maintainers want commit 2 changed or removed, rewrite only that commit:
  - `git rebase -i upstream/master`, then mark commit 2 as `drop` or `edit`;
  - push with `git push --force-with-lease`.

  Force-pushing is normal on your own PR branch. Commit 1 stays as it is.
- If they squash-merge, the two commits become one in their history. That's fine: the review still happens commit by
  commit.

## 6. Known limits to state openly

- **Commit 1** claims exactness only for the families whose CCDF matches their own probabilities: the discrete power
  law and the exponential, without `xmax`. The other three families differ by 0.6–2.2%. That mismatch predates the fix
  and is a candidate for a separate issue.
- **The `xmax` support disagreement** (the PMF includes `xmax`, the CDF does not) is not changed.
- **Not fixed:**
  - α ≤ 1 without `xmax` (`UnboundLocalError`);
  - values beyond 2^63 overflowing the `int64` output;
  - a non-integer `xmin` from `Fit` with discrete data.

## Appendix: the two-PR route

Use this only if the maintainers ask for separate PRs.

- **PR A:** a branch from `upstream/master` with `upstream-fix-a/0001-…patch` only.
- **PR B:** a second branch from `upstream/master` with `upstream-fix-b/0001-…patch`, the version for master,
  which keeps its own int64 guard in the loop.
- Use the "Draft PR" text in each `REPORT.md`.
- Mention in both PRs that they conflict in `_double_search_discrete`. If A is merged first, rebuild B from
  `upstream-fix-b/on-top-of-fix-a/0001-…patch`.
- Test counts: A alone 68 passed, B alone 64 passed (full suite).
