"""
Minimal reproduction: powerlaw 2.0.0 draws wrong discrete power-law samples.

  pip install powerlaw==2.0.0 scipy numpy
  python repro_powerlaw_bug.py

Part 1 uses generate_random() as a user would (20,000 random draws, so about ±0.007 sampling noise).
Part 2 feeds evenly spaced quantiles into the inverse-transform search itself (no noise).
Part 3 checks the approximate generator (estimate_discrete=True) against its closed form.
"""
import warnings
import numpy as np
import scipy.special as ss
import powerlaw

warnings.filterwarnings("ignore")
alpha = 2.5
exact = lambda k, xmin: k ** -alpha / ss.zeta(alpha, xmin)

print(f"powerlaw {powerlaw.__version__}, alpha = {alpha}")
print("\n1) generate_random(20000): P(K = k) generated vs exact")
np.random.seed(0)
for xmin in (1, 2, 3, 4, 5, 8, 10):
    x = powerlaw.Power_Law(xmin=xmin, parameters=[alpha], discrete=True).generate_random(20_000).astype(int)
    cells = "  ".join(f"P({k})={np.mean(x == k):.3f}/{exact(k, xmin):.3f}" for k in range(xmin, xmin + 3))
    print(f"   xmin={xmin:2d}: {cells}")

print("\n2) inverse-transform search on 2000 evenly spaced quantiles: max |CDF error| (exact inversion: <= 0.0005)")
M = 2000
for xmin in (1, 2, 3, 4, 5, 6, 8, 10, 16, 20):
    d = powerlaw.Power_Law(xmin=xmin, parameters=[alpha], discrete=True, estimate_discrete=False)
    out = np.array([d._double_search_discrete((i + 0.5) / M) for i in range(M)])
    ks = np.arange(xmin, xmin + 3000)
    cdf_gen = np.searchsorted(np.sort(out), ks, side="right") / M
    cdf_exact = 1 - ss.zeta(alpha, ks + 1) / ss.zeta(alpha, xmin)
    err = np.abs(cdf_gen - cdf_exact).max()
    print(f"   xmin={xmin:2d}: {err:.4f}  {'ok' if err <= 1 / M + 1e-12 else 'WRONG'}")

print("\n3) approximate generator (estimate_discrete=True), P(K = xmin) vs exact")
for xmin in (10, 20, 50):
    d = powerlaw.Power_Law(xmin=xmin, parameters=[alpha], discrete=True, estimate_discrete=True)
    r = (np.arange(M) + 0.5) / M
    out = np.array([d._generate_random_discrete_estimate(ri) for ri in r])
    clauset = np.floor((xmin - 0.5) * (1 - r) ** (-1 / (alpha - 1)) + 0.5)  # Clauset et al. (2009), eq. D.6
    print(f"   xmin={xmin}: powerlaw {np.mean(out == xmin):.4f}   eq. D.6 with floor {np.mean(clauset == xmin):.4f}   exact {exact(xmin, xmin):.4f}")
