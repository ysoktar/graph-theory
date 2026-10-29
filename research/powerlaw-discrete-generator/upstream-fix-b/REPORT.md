# Fix B: discrete `generate_random()` hangs outside `parameter_ranges`

Local branch `fix/out-of-range-generation` on upstream `master` `d2b563a`. The patch is
`0001-Raise-instead-of-hanging-when-generating-discrete-da.patch` (apply with `git am`). Nothing has been pushed or
filed upstream.

Environment: Python 3.13.17, NumPy 2.5.4, SciPy 1.18.1, editable powerlaw `2.0.1.dev29` (master), Linux.

## What happens on master

Each call below was run in its own interpreter with a 15 s timeout (`investigate.py`, outputs in
`investigate_master.txt` and `investigate_fixed.txt`).

- **Hangs:** the discrete exact `generate_random` for
  - `Power_Law` α = 3.5;
  - `Power_Law` α = 3.0, because `in_range()` excludes the bounds of the default range (0, 3);
  - `Truncated_Power_Law` [3.5, 0.01];
  - `Exponential` λ = −0.1;
  - `Lognormal` σ = −1.
- **Cause:** outside the range `cdf()` returns 1e-307 for every x (distributions.py lines 1006–1007). So `ccdf` is 1
  everywhere, and the doubling loop of `_double_search_discrete` (line 1703) never ends.
- **With `xmax = 1000`:** no hang, but an unrelated `TypeError` from `int(None)`.
- **Ignore the range and return samples:** the discrete estimate path and the continuous path.
- **Silently return constants:** `pdf`, `cdf` and `loglikelihoods` (1e-307 and −706.9).
- **`Fit`** never calls `generate_random`. Fitting α = 3.5 data with a fixed `xmin` ends at 2.999999999999999, which is
  inside the range, so no hang there.

## Change

- `generate_random`: one `in_range()` check in the exact discrete branch. It raises a `ValueError` that names the
  parameter, its value and the allowed range, and suggests passing `parameter_ranges`.
- `_double_search_discrete`: raises a `RuntimeError` once x no longer fits in int64 (2^63). This is defence in depth:
  master already fails at that point, with an opaque SciPy `TypeError`.
- Unchanged: `pdf`, `cdf`, `ccdf`, the estimate and continuous generators, and every result for in-range
  parameters.

## Tests

New `testing/test_generation_out_of_range.py` (7 tests). Calls that could hang run in a subprocess with a 30 s timeout,
so a regression fails instead of hanging the suite.

| Run | Result |
|---|---|
| New tests on master (RED) | 4 failed (three timeouts and the xmax `TypeError`), 3 passed |
| New tests on the branch (GREEN) | 7 passed in 7.4 s; rerun by the main session: 7 passed in 6.7 s |
| `python -m pytest testing -q`, master | 57 passed, 0 failed (11 min 42 s) |
| `python -m pytest testing -q`, branch | 64 passed, 0 failed (12 min 05 s) |

## Combined with fix A

Fix A rewrites `_double_search_discrete` as an integer search with its own termination guard, so the two patches
conflict in that function. Resolution: keep fix A's loop, and drop this patch's 2^63 guard, which no longer applies
there. Keep this patch's `in_range()` check in `generate_random`, which merges cleanly. With that one-hunk resolution
all 18 new tests (fix A's 11 and this patch's 7) pass, and the full suite gives 75 passed and 0 failed.

## Policy question for the maintainers

Should `parameter_ranges` constrain only fitting, or also distributions built with explicit parameters? Since PR #115
(issue #113) the default α range is (0, 3), so every hand-built discrete power law with α ≥ 3, including the
Barabási–Albert exponent 3, is affected.

- Recommended now: (a) fail fast. It is uncontroversial, and the tests guarantee termination.
- For discussion: (b) generation ignores `parameter_ranges`, which would make the three generation paths consistent.
  If the maintainers choose (b), the `ValueError` can later be replaced by generation, and the termination tests
  still hold.
- Also ask whether the bounds should be inclusive.

## Found but out of scope

- α ≤ 1 without `xmax`: `UnboundLocalError: x1`.
- r = 0 exactly: `TypeError`.
- α = 1.01 with r close to 1: x passes int64; now a readable `RuntimeError`.
- `Fit(x, discrete=True)` with a scanned `xmin` returned the non-integer `xmin` 3.90, and its `generate_random`
  then raised "No data points in defined range". This is a support-convention question for fix A.

## Draft issue

**Title:** Discrete `generate_random()` hangs when parameters are outside `parameter_ranges` (e.g. any α ≥ 3)

Environment: powerlaw master `d2b563a` (and 2.0.0, same code path); Python 3.13.17, NumPy 2.5.4, SciPy 1.18.1,
Linux.

Reproduction (run under a timeout, e.g. `timeout 20 python repro.py; echo $?` gives 124):

```python
import powerlaw
d = powerlaw.Power_Law(xmin=1, parameters=[3.5], discrete=True, estimate_discrete=False)
print(d.in_range())   # False: the default range is alpha in (0, 3), bounds excluded
d.generate_random(1)  # never returns
```

The same happens with `parameters=[3.0]`, `Truncated_Power_Law([3.5, 0.01])`, `Exponential([-0.1])` and
`Lognormal([1, -1])`. With `xmax=1000` it raises `TypeError: int() argument must be ... 'NoneType'` instead.

Observed: outside `parameter_ranges`, `cdf()` returns 1e-307 for every x, so `ccdf()` is 1 everywhere. The doubling
loop in `_double_search_discrete` (`while self.ccdf(data=[x2]) >= (1 - r)`) never terminates. The continuous path and
`estimate_discrete=True` ignore the range and return samples.

Expected: valid samples, or a prompt and clear error. Never a hang.

Questions:

1. Should `parameter_ranges` constrain fitting only, or also distributions built with explicit parameters? Since #115
   (for #113) set the default range to `[0, 3]`, every hand-built discrete power law with α ≥ 3 is affected.
2. Should the bounds be inclusive, so that α = 3 is valid?

Related: #120 / #121 and #69 (exceptions at the edge of the domain, not hangs). Open PR #110 touches the CDF code.

## Draft PR

**Title:** Raise instead of hanging when generating discrete data outside `parameter_ranges`

Refs #<issue B>

**Problem.** The exact discrete generator inverts the CCDF with a doubling search. Outside `parameter_ranges`,
`cdf()` is about 0 everywhere, so the search never ends (with `xmax` it raises an unrelated `TypeError`). With the
default range (0, 3) this affects every hand-built discrete power law with α ≥ 3, including α = 3.

**Change.**
- `generate_random`: one `in_range()` check in the exact discrete branch. It raises a `ValueError` that names the
  parameter, its value and the range, and suggests `parameter_ranges=...`.
- `_double_search_discrete`: raises a `RuntimeError` once x no longer fits in int64 (defence in depth).
- No change to `pdf`, `cdf` or `ccdf`, to the estimate or continuous generators, or to in-range results.

**Test evidence.**
- New `testing/test_generation_out_of_range.py`. Calls that could hang run in a subprocess with a 30 s timeout.
- RED on master: 4 failed, 3 passed.
- GREEN: 7 passed.
- `python -m pytest testing -q`: master 57 passed; branch 64 passed.

**Scope and non-goals.**
- Does not decide whether ranges apply to hand-built distributions, or whether bounds are inclusive (see the issue).
- Does not change the accuracy of the discrete inverse search; that is a separate issue and PR.
- Does not fix α ≤ 1 without `xmax`, r = 0, or a non-integer `xmin` from `Fit`.
