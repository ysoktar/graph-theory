# Independent cross-check of the JavaScript bootstrap p-value, in Python:
# fits by the powerlaw package (as in the notebook), but synthetic power-law tails drawn with an
# exact inverse-CDF sampler (scipy's Hurwitz zeta), avoiding powerlaw's broken discrete generator.
import json, sys, warnings, numpy as np, powerlaw, scipy.special as ss
warnings.filterwarnings("ignore")
name, reps = sys.argv[1], int(sys.argv[2])
import os
d = json.load(open(os.path.join(os.path.dirname(__file__), "..", "..", "site", "data", "networks.json")))["networks"][name]["degreeHist"]
k = np.repeat(d["k"], d["count"]); k = k[k > 0]
KW = {"parameter_ranges": {"alpha": [1, 10]}}
f = powerlaw.Fit(k, discrete=True, verbose=False, **KW)
D0, kmin, a = f.power_law.D, int(f.xmin), f.power_law.alpha

def exact_sampler(alpha, kmin, size, rng, table=200000):
    ks = np.arange(kmin, kmin + table)
    sf = ss.zeta(alpha, ks) / ss.zeta(alpha, kmin)            # P(K >= k)
    u = 1 - rng.random(size)                                  # (0, 1]
    idx = np.searchsorted(-sf, -u, side="right") - 1          # largest i with sf[i] >= u
    out = ks[np.clip(idx, 0, table - 1)].astype(np.int64)
    far = u < sf[-1]                                          # beyond the table: continuous tail (exact to many digits there)
    kc = kmin + table
    out[far] = np.floor((kc - 0.5) * (u[far] / (ss.zeta(alpha, kc) / ss.zeta(alpha, kmin))) ** (-1 / (alpha - 1)) + 0.5)
    return out

# self-test of the sampler
rng = np.random.default_rng(1)
x = exact_sampler(a, kmin, 400000, rng)
for kk in range(kmin, kmin + 3):
    print(f"sampler check p({kk}): {np.mean(x == kk):.4f} vs exact {kk**-a / ss.zeta(a, kmin):.4f}")

body = k[k < kmin]; n = k.size; ptail = (k >= kmin).mean()
exceed = 0
for r in range(reps):
    nt = rng.binomial(n, ptail)
    synth = np.concatenate([exact_sampler(a, kmin, nt, rng), rng.choice(body, n - nt)])
    exceed += powerlaw.Fit(synth, discrete=True, verbose=False, **KW).power_law.D >= D0
print(f"{name}: Python bootstrap (powerlaw fits, exact sampler) p = {exceed / reps:.3f} over {reps} replicates (kmin={kmin}, gamma={a:.3f}, D={D0:.4f})")
