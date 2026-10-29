import sys, warnings, numpy as np, powerlaw
sys.path.insert(0, sys.argv[1]); from newsearch import new_search
warnings.filterwarnings("ignore")
old_search = powerlaw.distributions.Distribution._double_search_discrete
cases = [("Exponential", [0.1]), ("Truncated_Power_Law", [1.5, 1e-3]), ("Stretched_Exponential", [0.1, 0.7]), ("Lognormal", [1.0, 1.5])]
n = 3000; grid = (np.arange(n) + 0.5) / n
for name, par in cases:
    d = getattr(powerlaw, name)(xmin=5, parameters=par, discrete=True)
    old = np.array([old_search(d, u) for u in grid]); new = np.array([new_search(d, u) for u in grid])
    ks = np.arange(5, 11); cc = d.ccdf(data=np.arange(5, 12)); pdf = d.pdf(data=ks)
    f = lambda s: np.array([np.mean(s == k) for k in ks])
    print(f"{name} xmin=5: max|freq-ccdf diff| master {np.max(np.abs(f(old)-(cc[:-1]-cc[1:]))):.4f}  new {np.max(np.abs(f(new)-(cc[:-1]-cc[1:]))):.4f} | "
          f"max|freq-pdf| master {np.max(np.abs(f(old)-pdf)):.4f}  new {np.max(np.abs(f(new)-pdf)):.4f} | changed {np.mean(old!=new):.3f}")
