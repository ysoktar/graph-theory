# Opening the two powerlaw PRs yourself

This guide takes the two local fixes to [powerlaw-devs/powerlaw](https://github.com/powerlaw-devs/powerlaw) as issues
and pull requests that you open yourself, from your own account and your own machine.

| Fix | Folder | Patch |
|---|---|---|
| A: discrete sampling bias | `upstream-fix-a/` | `0001-Fix-discrete-random-generation-exact-integer-inverse.patch` |
| B: hang outside `parameter_ranges` | `upstream-fix-b/` | `0001-Raise-instead-of-hanging-when-generating-discrete-da.patch` (applies to master) and `on-top-of-fix-a/0001-…patch` (applies once A is in) |

## 1. Are AI-assisted contributions allowed?

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
2. **Disclose the assistance in each issue and PR**, in one plain paragraph, for example:
   > The analysis, patch and tests were prepared with the help of an AI coding assistant (Claude). I have reviewed
   > the diff, rerun the tests listed below on my machine, and checked the numbers against an independent
   > Hurwitz-zeta calculation.

   Only write the second sentence once it is true.
3. **Rerun the evidence yourself** (step 3 below) and replace my environment lines (Python 3.13.17, NumPy 2.5.4,
   SciPy 1.18.1, Linux) with yours.
4. **Don't claim anything that hasn't been checked.** CI has not run yet; it runs when the PR is opened. Say so until
   it has run.

## 2. What has been checked, and by whom

| Claim in the drafts | Status |
|---|---|
| u = 0.30, α = 2.5, `xmin` = 5 gives 5; the exact answer is 6 (P(X ≥ 6) = 0.7419) | rerun by me on a clean powerlaw 2.0.0 |
| Masses for k = 3…10 at `xmin = 3`: 0.319, 0.293, 0.076, 0.054, 0.071, … (exact 0.389, 0.190, 0.109, …) | rerun by me on 2.0.0 |
| Approximate path P(K = xmin): 0.0741 / 0.0373 / 0.0150 (2.0.0) against 0.1391 / 0.0722 / 0.0296 (exact) for `xmin` = 10 / 20 / 50; with floor 0.1394 / 0.0723 / 0.0296 | rerun by me on 2.0.0 |
| Clauset et al. (2009): approximation Eq. (D.6) uses floor; exact method Eq. (D.5) narrows to k ≤ x < k + 1 | read in arXiv:0706.1062v2, Appendix D, pp. 39–40 |
| PMF–CCDF identity table per family (`identity.py`) | rerun by me on 2.0.0: identical numbers |
| Truncated power law α = 1.5, λ = 1e-3: P(K = 1) = 0.310 for master and fix, 0.399 for the discrete PMF (`tpl_grid.py`) | rerun by me |
| The same case with rounding gives 0.194 | computed once by the fix-A analysis; **not rerun**. Rerun it or leave it out |
| RED/GREEN: fix A 9 of 10 fail on master, 11 pass on the branch; fix B 4 of 7 fail on master, 7 pass | new tests rerun by me on the branches |
| Full suite: master 57, fix A 68, fix B 64, A + B 75 passed, 0 failed | from the saved logs of the runs on this machine |
| Bootstrap p-value of E. coli metabolism: 0.963 with powerlaw's generator, 0.113 with an exact sampler | from the earlier analysis in this folder (`FINDINGS.md`); fine as context, not needed for the issue |
| Behaviour on Windows, on macOS and on Python 3.8–3.12 | **not checked**; CI will show it |

## 3. Commands

On your own computer, with Git and Python 3.8 or newer installed.

### 3.1 Fork and clone

1. Open <https://github.com/powerlaw-devs/powerlaw> and click **Fork**. This creates `github.com/<you>/powerlaw`.
2. Clone it and set your identity:

```sh
git clone https://github.com/<you>/powerlaw.git
cd powerlaw
git remote add upstream https://github.com/powerlaw-devs/powerlaw.git
git config user.name "Your Name"
git config user.email "you@example.com"      # use the email of your GitHub account
```

### 3.2 Get the patches

Download the two `.patch` files from this repository's `research/powerlaw-discrete-generator/` folder (from GitHub, or
from a clone of graph-theory), for example into `~/patches/`.

### 3.3 Environment and baseline

```sh
python -m venv .venv
source .venv/bin/activate          # Windows PowerShell: .\.venv\Scripts\Activate.ps1
python -m pip install -U pip
python -m pip install -e . pytest
python -m pytest testing -q        # about 7–12 minutes; on master: 57 passed
```

### 3.4 Fix A

```sh
git switch -c fix/discrete-generation upstream/master
git am ~/patches/0001-Fix-discrete-random-generation-exact-integer-inverse.patch
git commit --amend --reset-author --no-edit     # makes you the author instead of the placeholder
python -m pytest testing/test_discrete_generation.py -q     # 11 passed
python -m pytest testing -q                                 # 68 passed
git push -u origin fix/discrete-generation
```

To see RED yourself, check out master's `powerlaw/distributions.py`
(`git checkout upstream/master -- powerlaw/distributions.py`) and run the new test file. 9 of the original 10 tests
should fail. Then restore it with `git checkout HEAD -- powerlaw/distributions.py`.

### 3.5 Fix B (a separate branch from master)

```sh
git switch -c fix/out-of-range-generation upstream/master
git am ~/patches/0001-Raise-instead-of-hanging-when-generating-discrete-da.patch
git commit --amend --reset-author --no-edit
python -m pytest testing/test_generation_out_of_range.py -q   # 7 passed
python -m pytest testing -q                                   # 64 passed
git push -u origin fix/out-of-range-generation
```

## 4. On GitHub

### 4.1 Issues first

1. Search the issues once more for `generate_random`, `discrete` and `hang`. The last search found nothing, but
   someone may have filed something since.
2. Open **issue A** with the draft in `upstream-fix-a/REPORT.md` ("Draft issue"). Add your environment and the
   disclosure paragraph.
3. Open **issue B** with the draft in `upstream-fix-b/REPORT.md`. It asks the maintainers two policy questions:
   - Should `parameter_ranges` constrain only fitting, or also generation?
   - Should α = 3 be inside the range?

### 4.2 Then the PRs, as drafts

1. On your fork, GitHub offers **Compare & pull request** for each pushed branch. The base must be
   `powerlaw-devs/powerlaw`, branch `master`.
2. Use the "Draft PR" text from each report. Put `Refs #<issue number>` at the top, add the disclosure paragraph,
   and choose **Create draft pull request**.
3. Wait for CI (Ubuntu with Python 3.8–3.12, Windows, macOS). If a job fails, fix it on the branch and push again
   before marking the PR ready for review.
4. In each PR, say that the two PRs touch the same function. Whichever is merged second needs a one-hunk rebase. For
   B after A, the ready-made patch is `upstream-fix-b/on-top-of-fix-a/`.

### 4.3 While waiting for review

- Answer review comments yourself. If you use an assistant to draft a reply, check every factual statement in it
  first.
- If the maintainers choose the other policy for B (generation ignores `parameter_ranges`), change the PR
  accordingly. The termination tests still apply.
- Mention open PR #110 (CDF changes) if a reviewer asks whether the two interact. It has not been tested against
  these patches.

## 5. Known limits to state openly

- **Fix A** claims exactness only for the families whose CCDF matches their own probabilities: the discrete power law
  and the exponential, without `xmax`. The truncated power law, stretched exponential and lognormal differ by
  0.6–2.2%. That mismatch predates the fix and is a candidate for a separate issue.
- **The `xmax` support disagreement** (the PMF includes `xmax`, the CDF does not) is not changed.
- **Not fixed by B:**
  - α ≤ 1 without `xmax` (`UnboundLocalError`);
  - r = 0 on master (fixed by A);
  - values beyond 2^63 overflowing the `int64` output;
  - non-integer `xmin` from `Fit` with discrete data.
