"""
Proposed fix for the discrete random generators of the `powerlaw` package (tested against 2.0.0),
with a deterministic test harness.

Two defects:

1. Distribution._double_search_discrete (exact inverse-transform sampling, used whenever
   estimate_discrete is False/None): it bisects a *continuous* interpolation of the CCDF with
   tol=0.5 inside a bracket [xmin*2^j, xmin*2^(j+1)] and returns int(x). The stopping interval is
   aligned with the integers only when the bracket endpoints are powers of two, so for xmin not a
   power of two probability mass lands on the wrong neighbouring integer.

2. Power_Law._generate_random_discrete_estimate (estimate_discrete=True): Clauset et al. (2009),
   eq. (D.6), is x = floor((xmin - 1/2)(1 - r)^(-1/(alpha-1)) + 1/2). The code computes the
   argument including the +1/2 and then applies np.around, i.e. rounds a value that was already
   shifted by 1/2: every sample is pushed up by half a unit on average.

The fix for (1) searches over integers only, using the distribution's own ccdf(k) = P(X >= k):
return the largest integer k with ccdf(k) >= 1 - r. Exponential search for a bracket, then integer
bisection. It is generic (it only uses ccdf at integers), so it also fixes the other discrete
distributions that go through this path (truncated power law, exponential, lognormal, ...).
The fix for (2) is to use np.floor.

A third, related defect: for parameters outside `parameter_ranges` (e.g. alpha > 3 with the default
range [0, 3]) `in_range()` is False, `cdf()` returns ~0 and `ccdf()` returns 1 for every x, so the
search never terminates and generate_random() hangs. The fix raises a ValueError instead.

Run:  python proposed_fix.py            (needs numpy, scipy, powerlaw; set M=2000 for a quicker run)
"""
import warnings
import numpy as np
import scipy.special as ss
import powerlaw
from powerlaw.distributions import Distribution, Power_Law

warnings.filterwarnings("ignore")

_original_search = Distribution._double_search_discrete
_original_estimate = Power_Law._generate_random_discrete_estimate


def _double_search_discrete_fixed(self, r):
    """Largest integer k >= xmin with P(X >= k) >= 1 - r (exact discrete inverse transform)."""
    assert 0 <= r <= 1, f"Invalid r value provided to search for: {r}"
    # 2.0.0 silently returns ccdf == 1 for out-of-range parameters, which makes any search loop forever
    if not self.in_range():
        raise ValueError(f"{self.name} parameters {self.parameters1} are outside parameter_ranges; "
                         "widen parameter_ranges before generating random numbers")
    target = 1 - r
    lo = int(np.ceil(self.xmin))           # invariant: ccdf(lo) >= target  (ccdf(xmin) = 1)
    xmax = int(np.floor(self.xmax)) if self.xmax else None

    def ccdf_at(k):
        if xmax is not None and k > xmax:
            return 0.0                      # beyond the support (ccdf would trim the point away)
        return self.ccdf(data=[k])[0]

    # exponential search for hi with ccdf(hi) < target
    step, hi = 1, lo + 1
    while ccdf_at(hi) >= target:
        lo = hi
        hi = lo + step
        step *= 2
        if step > 2 ** 62:
            raise RuntimeError("ccdf does not decay below 1 - r; cannot invert")
    # integer bisection, keeping ccdf(lo) >= target > ccdf(hi)
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if ccdf_at(mid) >= target:
            lo = mid
        else:
            hi = mid
    return lo


def _generate_random_discrete_estimate_fixed(self, r):
    if self.alpha <= 1:
        raise ValueError("Discrete power law random generator estimation only works for alpha > 1!")
    return np.floor((self.xmin - 0.5) * (1 - r) ** (-1 / (self.alpha - 1)) + 0.5)


# ------------------------------------------------------------------------------ test harness
def pmf_from_generator(gen_one, M, kmax):
    """Distribution produced by a generator fed M evenly spaced quantiles (no sampling noise)."""
    out = np.array([gen_one((i + 0.5) / M) for i in range(M)])
    return np.bincount(out.astype(np.int64), minlength=kmax + 2)[: kmax + 1] / M, out


def exact_powerlaw_pmf(alpha, xmin, kmax):
    k = np.arange(kmax + 1)
    p = np.zeros(kmax + 1)
    p[xmin:] = k[xmin:] ** -alpha / ss.zeta(alpha, xmin)
    return p


def report(label, p_gen, p_exact, xmin, M):
    cdf_err = np.abs(np.cumsum(p_gen) - np.cumsum(p_exact)).max()
    first = ", ".join(f"P({k})={p_gen[k]:.4f}/{p_exact[k]:.4f}" for k in range(xmin, xmin + 3))
    ok = "OK " if cdf_err <= 1.0 / M + 1e-12 else "BAD"
    print(f"  {ok} {label:28s} max|ΔCDF| = {cdf_err:.5f}   {first}  (generated/exact)")
    return cdf_err


if __name__ == "__main__":
    M = int(__import__("os").environ.get("M", 4000))  # quantile grid; an exact inverse gives max|ΔCDF| <= 1/M = 0.00025
    print(f"powerlaw {powerlaw.__version__}; deterministic grid of M = {M} quantiles\n")
    print("Power law, exact-search path (estimate_discrete=False):")
    for alpha in (1.8, 2.5, 3.5):
        for xmin in (1, 2, 3, 5, 6, 10, 20):
            d = powerlaw.Power_Law(xmin=xmin, parameters=[alpha], discrete=True, estimate_discrete=False,
                                   parameter_ranges={"alpha": [1, 10]})  # default range [0, 3] would hang at alpha = 3.5
            kmax = 4000
            pe = exact_powerlaw_pmf(alpha, xmin, kmax)
            p_old, _ = pmf_from_generator(lambda r: _original_search(d, r), M, kmax)
            p_new, _ = pmf_from_generator(lambda r: _double_search_discrete_fixed(d, r), M, kmax)
            print(f" alpha={alpha} xmin={xmin}")
            report("original", p_old, pe, xmin, M)
            report("fixed", p_new, pe, xmin, M)

    print("\nPower law, approximate path (estimate_discrete=True):")
    for alpha, xmin in ((2.5, 10), (2.5, 20), (3.0, 50)):
        d = powerlaw.Power_Law(xmin=xmin, parameters=[alpha], discrete=True, estimate_discrete=True)
        pe = exact_powerlaw_pmf(alpha, xmin, 4000)
        p_old, _ = pmf_from_generator(lambda r: float(_original_estimate(d, r)), M, 4000)
        p_new, _ = pmf_from_generator(lambda r: float(_generate_random_discrete_estimate_fixed(d, r)), M, 4000)
        print(f" alpha={alpha} xmin={xmin}  (an approximation: small residual error expected, shrinking as xmin grows)")
        report("original (np.around)", p_old, pe, xmin, M)
        report("fixed (np.floor)", p_new, pe, xmin, M)

    print("\nOther discrete distributions through the same search (pmf from the distribution's own ccdf):")
    for name, dist in (
        ("truncated power law", powerlaw.Truncated_Power_Law(xmin=5, parameters=[2.2, 0.01], discrete=True)),
        ("exponential", powerlaw.Exponential(xmin=5, parameters=[0.1], discrete=True)),
    ):
        kmax = 3000
        ks = np.arange(kmax + 2)
        cc = np.array([dist.ccdf(data=[k])[0] if k >= 5 else 1.0 for k in ks])
        pe = np.zeros(kmax + 1); pe[5:] = cc[5:kmax + 1] - cc[6:kmax + 2]
        p_old, _ = pmf_from_generator(lambda r: _original_search(dist, r), M, kmax)
        p_new, _ = pmf_from_generator(lambda r: _double_search_discrete_fixed(dist, r), M, kmax)
        print(f" {name} (xmin=5)")
        report("original", p_old, pe, 5, M)
        report("fixed", p_new, pe, 5, M)
