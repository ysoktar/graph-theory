# Fix A: discrete `generate_random()` samples the wrong distribution

Local branch `fix/discrete-generation` on upstream `master` `d2b563a`. The patch is
`0001-Fix-discrete-random-generation-exact-integer-inverse.patch` (apply with `git am`). Nothing has been pushed or
filed upstream.

Environment: Python 3.13.17, NumPy 2.5.4, SciPy 1.18.1, mpmath 1.4.1, editable powerlaw (master), Linux.

## The defects on master

1. **Exact path.** `Distribution._double_search_discrete` brackets the answer by doubling from `xmin`, bisects a
   continuous interpolation of the CCDF with `tol=0.5`, and truncates the result with `int(x)`. The final bracket
   lines up with the integers only when `xmin` is a power of two.
   - Counterexample: `Power_Law(xmin=5, parameters=[2.5], discrete=True, estimate_discrete=False)._double_search_discrete(0.30)`
     returns 5.
   - The exact answer is 6, because P(X ≥ 6) = ζ(2.5, 6)/ζ(2.5, 5) = 0.7419 ≥ 1 − 0.30.
   - At `xmin = 3` the generated masses for k = 3…10 start 0.319, 0.293, 0.076, 0.054, 0.071: not even monotone.
2. **Approximate path.** `Power_Law._generate_random_discrete_estimate` returns
   `np.around((xmin − ½)(1 − r)^(−1/(α−1)) + ½)`. The +½ is already the shift of Clauset et al. (2009, Appendix D),
   whose Eq. (D.6) rounds that value down: x = ⌊y + ½⌋, the nearest integer to y. Rounding it again shifts every value by another half and roughly halves
   P(K = xmin): 0.074 instead of 0.139 at α = 2.5, `xmin = 10`.

## Change

- **`_double_search_discrete`:** integer search for the largest k with `ccdf(k) ≥ 1 − u` (doubling, then bisection
  over integers), clipped at `xmax`. Because `ccdf(k) = P(X ≥ k)`, each integer k is returned for a set of u of
  size `ccdf(k) − ccdf(k + 1)`, which is exact inverse transform sampling. In addition:
  - u = 0 returns `xmin`; master raised `TypeError`.
  - A non-integer `xmin` raises a clear `ValueError`. On master the distribution then lives on 5.5, 6.5, …, and
    generation failed with an unrelated "No data points" error.
  - A `RuntimeError` is raised only past 2^1020, where floats end. Valid heavy-tailed draws can need values beyond
    2^62. Values above 2^63 still overflow the `int64` cast in `generate_random`, as they did before.
- **`_generate_random_discrete_estimate`:** `np.around` becomes `np.floor`. The `xmax` bound in `generate_random` now
  aims at `xmax − 0.5`, between the steps `xmax − 1` and `xmax` of the new step function, and samples are clipped
  below `xmax`.

## Tests

New `testing/test_discrete_generation.py` (11 tests). It uses deterministic quantile grids against an independent
Hurwitz-zeta oracle, not seeded random comparisons.

| Run | Result |
|---|---|
| New tests on master (RED) | 9 of the original 10 fail for the intended reasons: 5 instead of 6 at u = 0.30; with `xmax = 50` the search stops one integer short; P(K = 10) = 0.074 instead of 0.139 |
| New tests on the branch (GREEN) | 11 passed; rerun by the main session: 11 passed in 29.8 s |
| `python -m pytest testing -q`, master | 57 passed, 0 failed |
| `python -m pytest testing -q`, branch | 68 passed, 0 failed |

- `test_generate_random_respects_xmax` already passes on master; it guards the new `xmax` handling.
- `test_non_integer_xmin_is_rejected` was added after the RED run and was not run on master.

## Which families the integer search is exact for

The integer search inverts each distribution's own `ccdf`. It reproduces the family's own discrete distribution only
where `ccdf(k)` equals Σ_{j ≥ k} pmf(j). Measured on master at `xmin = 5` (`identity.py`; in every case `ccdf(k)`
means P(X ≥ k)):

| Family | No `xmax` | `xmax = 50` |
|---|---|---|
| Power_Law | matches (1e-7) | off by 8e-4 |
| Exponential | matches (5e-16) | off by 1.1e-3 |
| Truncated_Power_Law | off by 2.2e-2 | off by 2.0e-2 |
| Stretched_Exponential | off by 6e-3 | off by 4e-3 |
| Lognormal | off by 1.4e-2 | off by 1.1e-2 |

- The last three use a continuous CDF but a separately normalised discrete PMF.
- With `xmax`, `cdf` covers [xmin, xmax) (`ccdf(xmax) = 0`) while the PMF includes `xmax`.
- Both disagreements predate this change and are not part of it. The fix reproduces each family's own `ccdf` to
  3e-4, and moves every family closer to its PMF (for example Exponential: 0.033 → 0.0003).

## The PR #115 question: rounding versus truncation for truncated power laws

- **The tests behind the TODO** are `test_synthetic_data.py::…test_truncated_power_law_discrete` and
  `…_discrete_xmax`. They use `xmin = 1`, where master was already exact. The fix gives bit-identical seeded samples
  there (0 differing values).
- **Why truncation beat rounding:** this family's `ccdf` is the continuous one, so the integer inverse is
  ⌊X_continuous⌋, and that is closer to the PMF than rounding. For α = 1.5, λ = 1e-3 (`tpl_grid.py`):

  | How K is drawn | P(K = 1) |
  |---|---|
  | floor of the continuous variate (master and this fix) | 0.310 |
  | rounding (the alternative discussed in PR #115) | 0.194 |
  | the family's own discrete PMF | 0.399 |

- Even the floor does not reproduce the family's discrete PMF. That probably explains why those tests need a doubled
  tolerance. It is a separate issue, not part of this fix.

## Combined with fix B

Both patches edit `_double_search_discrete`, so they conflict textually. In the combined code tested here, fix A's
search replaces the loop, which already has its own guard, and fix B's `in_range()` check in `generate_random`
applies unchanged. That combination passes all 18 new tests, and the full suite gives 75 passed and 0 failed (57 + 11 + 7); see `../upstream-fix-b/REPORT.md`. Whichever PR is merged
second needs this one-hunk rebase.

## Open points

- Open PR #110 ("fix cumulative_distribution_function") may change the CDF this search inverts.
- Citation checked against the paper (arXiv:0706.1062v2, Appendix D, pp. 39–40).
  - The approximation is Eq. (D.6), x = ⌊(xmin − ½)(1 − r)^(−1/(α−1)) + ½⌋, with floor brackets. The text
    explains it as rounding y to the nearest integer, x = ⌊y + ½⌋, and warns that truncating y instead
    "give[s] substantially poorer results".
  - The exact method is Eq. (D.5): doubling up, then binary search "until the value of x is narrowed down to
    k ≤ x < k + 1", then discarding the non-integer part. The integer search in this patch does exactly that;
    master instead stops the bisection at a tolerance of 0.5 on a continuous interpolation.
  - The code comments now cite Eq. (D.5) and Eq. (D.6).
- CI on Python 3.8–3.12, Windows and macOS has not run yet. It will run on the draft PR.

## Draft issue

**Title:** Discrete `generate_random` returns wrong values for most `xmin` (integer truncation in
`_double_search_discrete`, rounding in the discrete estimate)

Environment: powerlaw master `d2b563a` and 2.0.0 (same code); Python 3.13.17, NumPy 2.5.4, SciPy 1.18.1.

Reproduction:

```python
import powerlaw
from scipy.special import zeta
d = powerlaw.Power_Law(xmin=5, parameters=[2.5], discrete=True, estimate_discrete=False)
print(d._double_search_discrete(0.30))   # 5
print(zeta(2.5, 6) / zeta(2.5, 5))       # 0.7419 >= 0.70, so the inverse CDF is 6
```

Observed:

- For `xmin` that is not a power of two the generated distribution is wrong. At `xmin = 3` the masses for k = 3…10
  are 0.319, 0.293, 0.076, 0.054, 0.071, …, not even monotone.
- The approximate path (`estimate_discrete=True`, the default for `xmin ≥ 10`) gives P(K = 10) = 0.074 instead of 0.139
  at α = 2.5, because it rounds a value that already includes the +½ shift.
- Anything built on `generate_random`, such as a bootstrap goodness-of-fit test, inherits the bias.

Expected: exact inverse transform sampling of P(K = k) = k^−α / ζ(α, xmin), and the floor of Clauset et al. (2009),
Eq. (D.6).

Scope: the exact search and the approximate rounding. The out-of-range hang is a separate issue.

Related: #69, #104, #115 (thread r2649110410), #118, #120; open PR #110.

## Draft PR

**Title:** Fix discrete random generation: exact integer inverse search, floor in the discrete estimate

Refs #<issue A>

**Problem.** See the issue: a continuous bisection followed by truncation puts probability on the wrong integers,
and the approximate path rounds after a half-unit shift.

**Change.**
- An integer inverse-CDF search on the distribution's own `ccdf`, clipped at `xmax`; u = 0 returns `xmin`; a
  non-integer `xmin` raises a clear error.
- `np.floor` in `_generate_random_discrete_estimate`, with the `xmax` bound adjusted to the new step function.
- Deterministic regression tests against an independent Hurwitz-zeta oracle.

**Test evidence.**
- RED on master: 9 of 10 new tests fail, each for the intended defect.
- GREEN: 11 passed.
- `python -m pytest testing -q`: master 57 passed; branch 68 passed.
- CI: link once the draft PR runs.

**Scope and non-goals.**
- No correctness claim for the continuous-CDF families (truncated power law, stretched exponential, lognormal),
  whose `ccdf` differs from their own discrete PMF. That mismatch predates this change and is left for a separate
  issue.
- The support disagreement at `xmax` (PMF includes it, CDF does not) is not changed.
- The `parameter_ranges` hang is a separate issue and PR.
