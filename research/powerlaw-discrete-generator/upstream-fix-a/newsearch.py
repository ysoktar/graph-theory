import numpy as np

def new_search(self, r):
    """Candidate fix: largest supported integer k with ccdf(k) = P(X >= k) >= 1 - r."""
    assert r >= 0 and r <= 1, f'Invalid r value provided to search for: {r}'
    if not float(self.xmin).is_integer():
        raise ValueError(f'Discrete random generation needs an integer xmin, got {self.xmin}.')
    target = 1 - r
    lo = int(self.xmin)                                  # ccdf(xmin) = 1 >= target
    top = int(np.floor(self.xmax)) if self.xmax else None
    ccdf = lambda k: self.ccdf(data=[k])[0]
    step, hi = 1, lo + 1
    while True:
        if top is not None and hi > top:
            hi = top + 1                                 # nothing is supported above xmax
            break
        if not ccdf(hi) >= target:
            break
        lo, step = hi, 2 * step
        hi = lo + step
        if step > 2**62:
            raise RuntimeError(f'ccdf does not fall below 1 - r = {target}; cannot invert it.')
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if ccdf(mid) >= target:
            lo = mid
        else:
            hi = mid
    return lo
