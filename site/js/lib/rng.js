// Seeded pseudo-random numbers, so every figure is reproducible ("seed" controls in the UI).

/** A small, fast, seeded generator (xoshiro128**), with the samplers the site needs. */
export class RNG {
  constructor(seed = 2026) {
    this.seed(seed);
  }

  seed(seed) {
    // SplitMix32 to spread the seed over the 128-bit state.
    let s = (Number(seed) >>> 0) || 0x9e3779b9;
    const next = () => {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.a = next(); this.b = next(); this.c = next(); this.d = next();
    this._spare = null;
    return this;
  }

  /** Uniform in [0, 1). */
  random() {
    const r = Math.imul(rotl(Math.imul(this.b, 5) >>> 0, 7), 9) >>> 0;
    const t = (this.b << 9) >>> 0;
    this.c ^= this.a; this.d ^= this.b; this.b ^= this.c; this.a ^= this.d;
    this.c ^= t; this.d = rotl(this.d, 11);
    return r / 4294967296;
  }

  /** Uniform integer in [0, n). */
  int(n) {
    return Math.floor(this.random() * n);
  }

  /** Standard normal (Marsaglia polar method). */
  normal() {
    if (this._spare !== null) { const s = this._spare; this._spare = null; return s; }
    let u, v, s;
    do { u = 2 * this.random() - 1; v = 2 * this.random() - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
    const m = Math.sqrt(-2 * Math.log(s) / s);
    this._spare = v * m;
    return u * m;
  }

  /** Exponential with rate lambda (mean 1/lambda). */
  exponential(lambda = 1) {
    return -Math.log(1 - this.random()) / lambda;
  }

  /** Poisson(lambda): inversion for small lambda, PTRS (Hörmann 1993) otherwise. */
  poisson(lambda) {
    if (lambda <= 0) return 0;
    if (lambda < 12) {
      const L = Math.exp(-lambda);
      let k = 0, p = this.random();
      let f = L, F = L;
      while (p > F) { k++; f *= lambda / k; F += f; if (k > 1000) break; }
      return k;
    }
    const slam = Math.sqrt(lambda), loglam = Math.log(lambda);
    const b = 0.931 + 2.53 * slam, a = -0.059 + 0.02483 * b, invalpha = 1.1239 + 1.1328 / (b - 3.4), vr = 0.9277 - 3.6224 / (b - 2);
    for (;;) {
      const U = this.random() - 0.5, V = this.random(), us = 0.5 - Math.abs(U);
      const k = Math.floor((2 * a / us + b) * U + lambda + 0.43);
      if (us >= 0.07 && V <= vr) return k;
      if (k < 0 || (us < 0.013 && V > us)) continue;
      if (Math.log(V) + Math.log(invalpha) - Math.log(a / (us * us) + b) <= -lambda + k * loglam - logGammaInt(k + 1)) return k;
    }
  }

  /** Binomial(n, p): direct for small n, normal-corrected Poisson/inversion otherwise. */
  binomial(n, p) {
    if (n <= 0 || p <= 0) return 0;
    if (p >= 1) return n;
    if (n < 40) { let k = 0; for (let i = 0; i < n; i++) if (this.random() < p) k++; return k; }
    const q = Math.min(p, 1 - p);
    // geometric waiting-time method: exact, O(np) expected time
    let k = 0, sum = 0;
    if (n * q < 30) {
      const lq = Math.log(1 - q);
      for (;;) {
        sum += Math.floor(Math.log(1 - this.random()) / lq) + 1;
        if (sum > n) break;
        k++;
      }
    } else {
      // n q >= 30: the normal approximation with continuity correction is very accurate here
      k = Math.round(n * q + Math.sqrt(n * q * (1 - q)) * this.normal());
      k = Math.max(0, Math.min(n, k));
    }
    return p <= 0.5 ? k : n - k;
  }

  /** Fisher–Yates shuffle, in place. */
  shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /** Random element of an array. */
  pick(a) {
    return a[Math.floor(this.random() * a.length)];
  }

  /** k distinct integers from [0, n) (Floyd's algorithm). */
  sample(n, k) {
    k = Math.min(k, n);
    const s = new Set();
    for (let j = n - k; j < n; j++) {
      const t = Math.floor(this.random() * (j + 1));
      s.add(s.has(t) ? j : t);
    }
    return [...s];
  }
}

function rotl(x, k) {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

const LG_CACHE = [0, 0];
function logGammaInt(n) {
  // log((n-1)!) for integer n >= 1
  if (n < 1000) {
    while (LG_CACHE.length <= n) LG_CACHE.push(LG_CACHE[LG_CACHE.length - 1] + Math.log(LG_CACHE.length - 1));
    return LG_CACHE[n];
  }
  const x = n;
  return (x - 0.5) * Math.log(x) - x + 0.5 * Math.log(2 * Math.PI) + 1 / (12 * x) - 1 / (360 * x ** 3);
}
