"""Run each case in a fresh interpreter with a timeout; report OK / exception / HANG."""
import subprocess, sys, textwrap
PY = sys.executable
CASES = {
 "PL discrete exact, alpha=3.5 (out of default [0,3])": "d=powerlaw.Power_Law(xmin=1, parameters=[3.5], discrete=True, estimate_discrete=False); print(d.in_range(), d.generate_random(3))",
 "PL discrete exact, alpha=3.0 (boundary: in_range uses strict <)": "d=powerlaw.Power_Law(xmin=1, parameters=[3.0], discrete=True, estimate_discrete=False); print(d.in_range(), d.generate_random(3))",
 "PL discrete exact, alpha=3.5, xmax=1000": "d=powerlaw.Power_Law(xmin=1, xmax=1000, parameters=[3.5], discrete=True, estimate_discrete=False); print(d.in_range(), d.generate_random(3))",
 "PL discrete estimate, alpha=3.5, xmin=10": "d=powerlaw.Power_Law(xmin=10, parameters=[3.5], discrete=True, estimate_discrete=True); print(d.in_range(), d.generate_random(3))",
 "PL continuous, alpha=3.5": "d=powerlaw.Power_Law(xmin=1, parameters=[3.5], discrete=False); print(d.in_range(), d.generate_random(3))",
 "PL discrete exact, alpha=3.5, widened range": "d=powerlaw.Power_Law(xmin=1, parameters=[3.5], discrete=True, estimate_discrete=False, parameter_ranges={'alpha':[1,10]}); print(d.in_range(), d.generate_random(3))",
 "PL pdf/cdf/ccdf/loglik, alpha=3.5": "d=powerlaw.Power_Law(xmin=1, parameters=[3.5], discrete=True); print(d.pdf([1,2,3]), d.cdf([1,2,3]), d.ccdf([2,100]), d.loglikelihoods([1,2]))",
 "TPL discrete, alpha=3.5, Lambda=0.01": "d=powerlaw.Truncated_Power_Law(xmin=1, parameters=[3.5, 0.01], discrete=True); print(d.in_range(), d.generate_random(3))",
 "Exponential discrete, Lambda=-0.1 (out of [0, None])": "d=powerlaw.Exponential(xmin=1, parameters=[-0.1], discrete=True); print(d.in_range(), d.generate_random(3))",
 "Exponential discrete, Lambda=0.1 (in range)": "d=powerlaw.Exponential(xmin=1, parameters=[0.1], discrete=True); print(d.in_range(), d.generate_random(3))",
 "Lognormal discrete, sigma=-1 (out of range)": "d=powerlaw.Lognormal(xmin=1, parameters=[1, -1], discrete=True); print(d.in_range(), d.generate_random(3))",
 "Lognormal discrete, mu=1 sigma=1 (in range)": "d=powerlaw.Lognormal(xmin=1, parameters=[1, 1], discrete=True); print(d.in_range(), d.generate_random(3))",
 "PL discrete, alpha=1.01 in range, r=1-2**-53 (degenerate tail)": "d=powerlaw.Power_Law(xmin=1, parameters=[1.01], discrete=True, estimate_discrete=False); print(d.in_range(), d._double_search_discrete(1-2**-53))",
 "PL discrete, alpha=0.8 in range but not normalisable (no xmax)": "d=powerlaw.Power_Law(xmin=1, parameters=[0.8], discrete=True, estimate_discrete=False); print(d.in_range(), d.generate_random(3))",
 "PL discrete exact, alpha=2.5, r=0 and r=1": "d=powerlaw.Power_Law(xmin=5, parameters=[2.5], discrete=True, estimate_discrete=False); print(d._double_search_discrete(0.0)); print(d._double_search_discrete(1.0))",
}
for name, code in CASES.items():
    src = "import warnings, numpy as np, powerlaw\nwarnings.filterwarnings('ignore')\nnp.random.seed(0)\n" + code
    try:
        p = subprocess.run([PY, "-c", src], capture_output=True, text=True, timeout=15)
        out = (p.stdout.strip() or "") + (" | ERR: " + p.stderr.strip().splitlines()[-1] if p.returncode else "")
        print(f"[{'OK ' if p.returncode == 0 else 'EXC'}] {name}: {out}")
    except subprocess.TimeoutExpired:
        print(f"[HANG] {name}: no result after 15 s")
