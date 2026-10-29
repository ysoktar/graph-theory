# Upstream status (checked 29 October 2026)

Upstream repository: [powerlaw-devs/powerlaw](https://github.com/powerlaw-devs/powerlaw), default branch `master`,
head `d2b563a` (9 April 2026). PyPI's 2.0.0 and `master` contain the same generator code:

- `Distribution._double_search_discrete` still bisects a continuous interpolation of the CCDF with `tol=0.5`
  and returns `int(x)`;
- `Power_Law._generate_random_discrete_estimate` still returns `np.around((xmin − ½)(1 − r)^(−1/(α−1)) + ½)`;
- nothing stops `generate_random` when `in_range()` is False.

There is no `CONTRIBUTING` file and no issue or PR template. `.github/` holds only `workflows/`. The README invites issues and
PRs and runs the tests with `python -m pytest testing -v`. CI (`tests.yml`) runs that command on Ubuntu (Python 3.8–3.12),
Windows and macOS (3.10, 3.11).

## Existing reports

Searched issues and PRs for `generate_random`, `discrete random`, `_double_search_discrete`, and
`hang OR infinite loop OR "parameter_ranges"`, and read #69, #104, #118, #120 and PR #115.

| # | Title | State | Relation |
|---|---|---|---|
| #69 | Exceptions when sampling discrete distribution | closed 2019 | same function; an xmax overshoot exception, not bias or hang |
| #104 | `estimate_discrete` should be False by default or warn for x_min < 6 | closed (v2.0 adds the warning) | fitting approximation, not generation |
| #118 | Random number generation doesn't respect xmax | closed (fixed in v2.0, #121) | xmax bound, not bias |
| #120 | Error handling None/empty values for discrete random number generation | closed (fixed in v2.0) | empty ccdf outside the domain inside `_double_search_discrete`: an exception, not a hang |
| PR #115 | Major refactor | merged 2 Jan 2026 | changed the default α range from [1, 3] to [0, 3] (issue #113). Review thread r2649110410: "the only test that actually fails with proper rounding is truncated power law"; the cause was left open |
| PR #110 | fix cumulative_distribution_function | open | may touch the CDF code that the integer search uses; check for interaction |

**Verdict:** neither the sampling bias (A) nor the out-of-range hang (B) has been reported. GitHub's search can miss
matches, so this means no report was found in these searches and pages.

## Plan (following the "Before the fix" guide)

1. Issue A: incorrect discrete sampling probabilities (exact path and approximate path), one issue, two tests.
2. Issue B: the out-of-range hang, a separate issue, because it needs an API decision from the maintainers:
   should `parameter_ranges` constrain fitting only, or also generation from explicit parameters?
3. One PR per issue, each with failing tests first (RED on master), then the minimal fix (GREEN), the full suite,
   and before/after evidence.

Nothing has been filed upstream yet. Issues and PRs are opened only after the user has reviewed them.
