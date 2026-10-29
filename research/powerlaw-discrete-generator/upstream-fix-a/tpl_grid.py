"""Deterministic comparison for the discrete truncated power law: which distribution does each search sample?"""
import sys, warnings, numpy as np, powerlaw
sys.path.insert(0, sys.argv[1]); from newsearch import new_search
warnings.filterwarnings("ignore")
old_search = powerlaw.distributions.Distribution._double_search_discrete
for par in [[1.5, 1e-3], [1.2, 1e-2]]:
    d = powerlaw.Truncated_Power_Law(xmin=1, parameters=par, discrete=True)
    n = 3000; grid = (np.arange(n) + 0.5) / n
    old = np.array([old_search(d, u) for u in grid]); new = np.array([new_search(d, u) for u in grid])
    ks = np.arange(1, 7)
    cc = d.ccdf(data=np.arange(1, 8))
    print(f"TPL {par}: k            ", ks)
    print("  master search freq    ", np.round([np.mean(old == k) for k in ks], 4))
    print("  new search freq       ", np.round([np.mean(new == k) for k in ks], 4))
    print("  ccdf(k)-ccdf(k+1)     ", np.round(cc[:-1] - cc[1:], 4))
    print("  exact discrete pdf(k) ", np.round(d.pdf(data=ks), 4))
    print("  master == new on", np.mean(old == new), "of the grid; max |old-new| =", np.max(np.abs(old - new)))
