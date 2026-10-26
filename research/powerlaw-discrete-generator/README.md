# Discrete power-law sampling in `powerlaw` 2.0.0, and an independent JavaScript implementation of the Clauset–Shalizi–Newman method

## How this came up

I am building an interactive teaching website for Barabási's *Network Science* (Ch. 2–4) and its class notebook,
which uses the Python package [`powerlaw`](https://pypi.org/project/powerlaw/) (Alstott, Bullmore & Plenz 2014).
All computation on the site runs in the browser, so I re-implemented the Clauset–Shalizi–Newman (CSN, 2009)
pipeline in JavaScript (`stats.js`, `rng.js`):

1. discrete power-law MLE for γ at each candidate k_min;
2. choice of k_min by minimal Kolmogorov–Smirnov distance D;
3. the semi-parametric bootstrap goodness-of-fit test (step 2 of CSN), which the class notebook omits.

To cross-check step 3, I re-ran the bootstrap in Python with `powerlaw` doing the fits and generating the
synthetic data. For the E. coli metabolic network (n = 1,039 degrees, k_min = 5, γ = 2.714) the two disagreed
completely: **p = 0.106 (JavaScript) against p = 0.963 (Python)**.

On identical synthetic samples the JavaScript and `powerlaw` fits agree (same k_min, γ within 0.005, D within
0.001), so the difference had to come from how the synthetic samples were *generated*. That led to the bugs below.
With the Python cross-check redone using an exact sampler, the two implementations agree:
**p = 0.113 (Python, 400 replicates) against 0.106 (JavaScript, 1,000 replicates)**.

---

## 1. Bug: `Distribution._double_search_discrete` (the "exact" discrete generator)

`generate_random()` for a discrete distribution goes through this function whenever `estimate_discrete` is
False or None. Standalone `Power_Law(...)` objects default to None.

### Symptom (`repro_powerlaw_bug.py`, 25 s)

α = 2.5. Feeding 2,000 evenly spaced quantiles into the search gives the generated CDF with no sampling noise.
An exact inversion gives a maximal CDF error ≤ 1/2000 = 0.0005.

| k_min | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 16 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|
| max \|ΔCDF\| | 0.0002 | 0.0002 | **0.0705** | 0.0002 | **0.0474** | **0.0470** | 0.0002 | **0.0299** | 0.0002 | **0.0168** |

The generator is correct exactly when k_min is a power of two. Otherwise probabilities are badly off and can
even *increase* with k, which is impossible for a power law. With 20,000 draws from `generate_random()`:

| k_min | P(k_min) generated / exact | P(k_min+1) | P(k_min+2) |
|---|---|---|---|
| 3 | 0.318 / 0.389 | 0.293 / 0.190 | 0.076 / 0.109 |
| 5 | 0.301 / 0.258 | 0.099 / 0.164 | 0.141 / 0.111 |
| 10 | 0.168 / 0.139 | 0.069 / 0.110 | 0.108 / 0.088 |

Same pattern for α = 1.8 (`proposed_fix_output_alpha_1.8_2.5.txt`). α = 3.5 could not be tested this way at first, because of the third defect below.

### Mechanism (`powerlaw/distributions.py`, v2.0.0)

```python
x2 = int(self.xmin)
while self.ccdf(data=[x2]) >= (1 - r):      # bracket by doubling: [xmin·2^j, xmin·2^(j+1)]
    x1 = x2
    x2 = 2*x1
func = lambda x: self.ccdf(data=[x])[0]     # evaluated at NON-integer x (continuous ζ(α, x) interpolation)
x = bisect_map(mn=x1, mx=x2, function=func, target=1-r, tol=0.5)
return int(x)                               # truncation
```

The bisection runs on a continuous interpolation of the CCDF and stops when the bracket is narrower than 0.5.
It then truncates. The final bracket lines up with the integers only when the starting bracket
[k_min·2^j, k_min·2^(j+1)] has power-of-two endpoints. Otherwise the stopping point falls on the wrong side of an
integer, and probability mass moves to a neighbouring value. A source comment mentions that rounding instead of
truncating "leads to very bad fits" for discrete truncated power laws (powerlaw PR #115 discussion). Neither
rounding nor truncation is right, because the search space itself is wrong: a discrete inverse transform has to
search over integers.

### Impact

- Wrong random samples for any discrete distribution that uses this path, whenever k_min is not a power of two.
- **Wrong goodness-of-fit p-values** for anyone bootstrapping with `generate_random`. The synthetic data do not
  follow the fitted model, so their KS distances are inflated and p is biased upwards (0.963 against a correct
  0.11 for the metabolic network). Users conclude that a power law is "plausible" when it is not.
- The class notebook itself is *not* affected: it calls `generate_random` once, with k_min = 1, where the
  generator happens to be exact.

## 2. Bug: `Power_Law._generate_random_discrete_estimate` (the approximate generator)

This is used with `estimate_discrete=True`, which is set when the parent `Fit` has `xmin >= 10`. A bootstrap
that calls `fit.power_law.generate_random(...)` on such a fit takes this path.

```python
x = (self.xmin - 0.5) * (1 - r) ** (-1/(self.alpha - 1)) + 0.5
return np.around(x)
```

Clauset et al. (2009, eq. D.6) give x = ⌊(x_min − ½)(1 − r)^(−1/(α−1)) + ½⌋, a **floor** of the shifted
value. Rounding a value that already includes the +½ shifts every sample up by half a unit on average:

| k_min (α = 2.5) | P(K = k_min): powerlaw | eq. D.6 with floor | exact |
|---|---|---|---|
| 10 | 0.0740 | 0.1395 | 0.1391 |
| 20 | 0.0375 | 0.0725 | 0.0722 |
| 50 | 0.0150 | 0.0295 | 0.0296 |

(This independently confirms an analysis I received from another reviewer.)

## 3. Bug: `generate_random()` hangs for parameters outside `parameter_ranges` (`repro_hang_out_of_range.py`)

`Power_Law(xmin=1, parameters=[3.5], discrete=True)` uses the default range α ∈ [0, 3], so `in_range()` is False.
`Distribution.cdf()` then returns about 1e-308 for every point ("If we aren't in range, we just return a bunch of
(nearly) zeros"), so `ccdf()` is 1.0 everywhere (it should be 0.112 at k = 2 and 3.6e-6 at k = 100). The
doubling loop `while self.ccdf(data=[x2]) >= (1 - r)` never ends, and `generate_random()` hangs with no error
or warning. The continuous generator is unaffected, and passing `parameter_ranges={'alpha': [1, 10]}` avoids the
hang. Steep tails (α > 3) are common in practice, for example in the Internet, phone-call and collaboration fits
of the book's data, so anyone simulating from such a fit can hit this. `fit.power_law` objects created inside a
`Fit(..., parameter_ranges=...)` inherit the wider range and are unaffected.

## 4. Proposed fix (`proposed_fix.py`, with a deterministic test harness)

- **Exact path:** search over integers only, using the distribution's own `ccdf(k) = P(X ≥ k)`, and return the
  largest integer k with ccdf(k) ≥ 1 − r. Exponential search finds a bracket, then integer bisection; the number
  of ccdf calls stays logarithmic, like the original. The fix is generic, since it only evaluates ccdf at
  integers, so it should also fix the truncated power law, the exponential and the lognormal, which use the same
  search. `xmax` is handled by treating values above it as ccdf = 0, because `ccdf()` trims data outside the
  range.
- **Approximate path:** `np.floor` instead of `np.around`.
- **Out-of-range parameters:** raise a `ValueError` at the start of the search when `in_range()` is False, plus a safety stop if the CCDF never falls below 1 − r.

Test results (`proposed_fix_output_alpha_1.8_2.5.txt`, quantile grid M = 2,000, so an exact inversion gives max |ΔCDF| ≤ 1/(2M) = 0.00025):

| case | original | fixed |
|---|---|---|
| power law, α ∈ {1.8, 2.5}, k_min ∈ {1, 2} | 0.00025 | 0.00025 |
| power law, α ∈ {1.8, 2.5}, k_min ∈ {3, 5, 6, 10, 20} | 0.009 – 0.070 | 0.00025 |
| approximate path, P(K = k_min) | about half the exact value | within 0.0004 of exact |
| truncated power law, exponential (k_min = 5), α = 3.5 | not run yet (the harness was stuck in the α = 3.5 hang; it now passes `parameter_ranges`) | not run yet |

Open questions about the fix: `xmax` and `xmin` given as non-integers; whether `int(np.ceil(xmin))` is the
intended lower bound; vectorisation (generation runs a Python loop per sample, so it is slow); and whether the
"very bad fits" remark in PR #115 came from this same bug.

## 5. The JavaScript implementation: what was checked

Files: `stats.js` (statistics) and `rng.js` (seeded xoshiro128** generator). Everything below can be re-run
from the scripts in this folder (`node <script>.mjs`, Node ≥ 20).

| what | how | result |
|---|---|---|
| Hurwitz ζ(s, q) (Euler–Maclaurin, 9 direct terms + 10 Bernoulli corrections) | against `scipy.special.zeta` at 7 points, s ∈ [1.05, 7.6], q ∈ [1, 70] | relative error < 1e-11 |
| exact sampler `discretePowerLawSampler` | quantile grid M = 200,000 over γ ∈ {1.5, 2.1, 2.5, 3, 3.5} × k_min ∈ {1, 2, 3, 4, 5, 6, 10, 20, 50, 100}; tail path forced with a 50-entry table (`validate_sampler.mjs`) | max \|ΔCDF\| = 2.5e-6, the grid's floor (bound 5e-6); tail path 4.3e-6 |
| MLE + k_min scan + KS (`fitPowerLaw`) | against `powerlaw` 2.0.0 on the eight networks of the book (`degree_histograms.json`) | identical k_min on all 8; γ within 0.01; D within 0.003; the Internet's 80-point k_min scan matches point by point |
| bootstrap p (`goodnessOfFit`) | Python cross-check: `powerlaw` fits + exact sampler (`python_crosscheck_exact.py`) | metabolic: 0.113 (Python, 400) against 0.106 (JS, 1,000) |
| bootstrap calibration | null data sets from the exact model, 300 × 100 replicates (`calibration_diagnostics.mjs`) | see below |

### Calibration of the bootstrap: it is conservative, and the reason is the k_min re-estimation

Share of p-values below 0.1 on data sets drawn from the null model (expected 0.10); KS distance of the p-values
from Uniform(0, 1) (5% critical value 0.079):

| variant | P(p < 0.1) | KS |
|---|---|---|
| A: full CSN, k_min re-estimated on every synthetic set, all candidates | 0.063 | 0.147 |
| B: as A, but candidates with fewer than 10 tail points skipped (the site's speed shortcut) | 0.053 | 0.077 |
| C: k_min fixed at its true value, only γ refitted | 0.123 | 0.040 |
| D: pure power law, k_min = 1 known | 0.107 | 0.060 |

C and D are calibrated, so the sampler, the fit and the bootstrap mechanics are right. The conservativeness
appears only when k_min is re-estimated, the step that makes CSN "semi-parametric", which suggests it is a
property of the method rather than a bug. It means rejections (p < 0.1) are trustworthy, while "plausible"
verdicts are somewhat generous. Power (variant B, tail with an exponential cutoff): rejection rate 0.05–0.20
for a mild cutoff (κ = 200) and 0.17–0.82 for κ = 50, at n = 1,039 and 10,000.

### Results for the book's eight networks (1,000 replicates each, `bootstrap_all_networks.mjs`)

| network | k_min | γ̂ | p | verdict at 0.1 |
|---|---|---|---|---|
| E. coli metabolism | 5 | 2.714 | 0.106 | plausible (barely) |
| Protein interactions | 7 | 2.783 | 0.902 | plausible |
| US power grid | 10 | 7.63 | 0.760 | plausible, but γ = 7.6 on 1% of the nodes |
| Science collaboration | 27 | 3.426 | < 0.001 | rejected |
| Mobile phone calls | 11 | 4.756 | 0.885 | plausible |
| Email | 3 | 1.908 | < 0.001 | rejected |
| Internet (routers) | 70 | 3.403 | 0.064 | rejected (borderline) |
| WWW (nd.edu) | 6 | 2.155 | < 0.001 | rejected |

The book's Advanced Topic 4.C reports p = 0.13 for the Internet (k_min = 72) and 0.0001 for collaboration.

### Choices you may want to challenge

- KS convention: both CDFs are P(K < x) at the tail's distinct values, matching `powerlaw`, not P(K ≤ x).
- γ is searched on [1.0001, 10] by golden section on the (concave) log-likelihood, with tolerance 1e-7.
- σ(γ̂) = (γ̂ − 1)/√n, the continuous formula that `powerlaw` also reports, not the discrete Fisher information.
- Bootstrap: each synthetic value comes from the tail with probability n_tail/n (Bernoulli per value, rather
  than a fixed binomial count drawn once). The body is resampled from the observed values below k_min, and
  k_min candidates with fewer than 10 tail points are skipped.
- `erfc` uses the Numerical Recipes Chebyshev approximation (relative error < 1.2e-7) for the likelihood-ratio
  p-values; only the exponential alternative is implemented.
- RNG: xoshiro128** seeded via SplitMix32; Poisson by inversion (λ < 12) or PTRS; binomial by geometric waiting
  times (nq < 30) or a normal approximation.
