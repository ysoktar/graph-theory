"""PMF-CCDF identity on master: is ccdf(k) == sum_{j>=k} pdf(j)  (P(X>=k)) or sum_{j>k} (P(X>k))?"""
import warnings, numpy as np, powerlaw
warnings.filterwarnings("ignore")
fams = [("Power_Law", [2.5]), ("Truncated_Power_Law", [2.0, 0.02]), ("Exponential", [0.1]),
        ("Stretched_Exponential", [0.1, 0.7]), ("Lognormal", [1.0, 1.5])]
for xmax in [None, 50]:
    for name, par in fams:
        d = getattr(powerlaw, name)(xmin=5, xmax=xmax, parameters=par, discrete=True)
        top = xmax if xmax else 200000
        ks = np.arange(5, top + 1)
        pmf = d.pdf(data=ks)
        tail = np.cumsum(pmf[::-1])[::-1]            # sum_{j>=k} pdf(j) over the computed range
        probe = np.array([5, 6, 8, 12, 20, 40])
        probe = probe[probe <= (xmax or 1e9)]
        cc = d.ccdf(data=probe)
        ge = tail[probe - 5]
        gt = np.append(tail, 0)[probe - 5 + 1]
        print(f"{name:22s} xmax={xmax}: sum(pmf)={pmf.sum():.6f}  max|ccdf-P(X>=k)|={np.max(np.abs(cc-ge)):.2e}  max|ccdf-P(X>k)|={np.max(np.abs(cc-gt)):.2e}  ccdf(xmin)={cc[0]:.6f}"
              + (f"  ccdf(xmax)={d.ccdf(data=[xmax])[0]:.3e} pmf(xmax)={pmf[-1]:.3e}" if xmax else ""))
# non-integer xmin for the discrete power law
d = powerlaw.Power_Law(xmin=5.5, parameters=[2.5], discrete=True)
print("xmin=5.5: pdf(5), pdf(5.5), pdf(6) =", [float(d.pdf(data=[x])[0]) if x >= 5.5 else 'trimmed' for x in (5, 5.5, 6)],
      " sum pdf(6..)=", float(d.pdf(data=np.arange(6, 200000)).sum()), " sum pdf(5.5+n)=", float(d.pdf(data=np.arange(5.5, 200000)).sum()))
