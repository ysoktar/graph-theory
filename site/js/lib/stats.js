// Statistics for degree distributions: special functions, Poisson/binomial laws, binning,
// and the Clauset–Shalizi–Newman power-law fit (book, Advanced Topic 4.C).

// ---------------------------------------------------------------- special functions

const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

/** ln Γ(x) for x > 0. */
export function logGamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x);
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

const LF = [0];
/** ln k! (exact table for small k). */
export function logFactorial(k) {
  if (k < 0) return NaN;
  if (k < 2000) {
    while (LF.length <= k) LF.push(LF[LF.length - 1] + Math.log(LF.length));
    return LF[k];
  }
  return logGamma(k + 1);
}

/** Complementary error function (Numerical Recipes' Chebyshev fit, relative error < 1.2e-7 everywhere,
 *  so tiny tail probabilities such as 1e-14 keep their precision). */
export function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
export const erf = (x) => 1 - erfc(x);
export const normalCdf = (x) => 0.5 * erfc(-x / Math.SQRT2);

// Bernoulli numbers B_2k / (2k)!  for the Euler–Maclaurin tail of the Hurwitz zeta function
const B2K = [1 / 6, -1 / 30, 1 / 42, -1 / 30, 5 / 66, -691 / 2730, 7 / 6, -3617 / 510, 43867 / 798, -174611 / 330];
const B2K_OVER_FACT = B2K.map((b, i) => {
  let f = 1;
  for (let j = 2; j <= 2 * (i + 1); j++) f *= j;
  return b / f;
});

/** Hurwitz zeta ζ(s, q) = Σ_{n≥0} (n+q)^(−s), for s > 1, q > 0 (Euler–Maclaurin, ~1e-15 relative). */
export function hurwitzZeta(s, q) {
  if (s <= 1) return Infinity;
  const N = 9;
  let sum = 0;
  for (let n = 0; n < N; n++) sum += Math.pow(q + n, -s);
  const a = q + N;
  sum += Math.pow(a, 1 - s) / (s - 1) + 0.5 * Math.pow(a, -s);
  // Σ_k B_2k/(2k)! · s(s+1)…(s+2k−2) · a^(−s−2k+1)
  let poch = s; // s(s+1)...(s+2k-2) for k=1 is just s
  let apow = Math.pow(a, -s - 1);
  const a2 = a * a;
  for (let k = 0; k < B2K_OVER_FACT.length; k++) {
    const term = B2K_OVER_FACT[k] * poch * apow;
    sum += term;
    if (Math.abs(term) < 1e-17 * sum) break;
    poch *= (s + 2 * k + 1) * (s + 2 * k + 2);
    apow /= a2;
  }
  return sum;
}
export const riemannZeta = (s) => hurwitzZeta(s, 1);

// ---------------------------------------------------------------- Poisson and binomial laws

export const poissonLogPmf = (k, lam) => (k < 0 ? -Infinity : k * Math.log(lam) - lam - logFactorial(k));
export const poissonPmf = (k, lam) => Math.exp(poissonLogPmf(k, lam));

/** log P(K ≥ k) for K ~ Poisson(λ), computed in log space (works far out in the tail, e.g. 10^-300). */
export function poissonLogSfGe(k, lam) {
  if (k <= 0) return 0;
  if (k <= lam) {
    // complement of a short CDF sum
    let cdf = 0;
    for (let j = 0; j < k; j++) cdf += poissonPmf(j, lam);
    return Math.log(Math.max(1e-300, 1 - cdf));
  }
  // tail sum from k upwards: terms decrease geometrically
  const l0 = poissonLogPmf(k, lam);
  let sum = 1, term = 1;
  for (let j = k + 1; j < k + 5000; j++) {
    term *= lam / j;
    sum += term;
    if (term < 1e-17 * sum) break;
  }
  return l0 + Math.log(sum);
}
/** P(K > k) = scipy.stats.poisson.sf(k, λ). */
export const poissonSf = (k, lam) => Math.exp(poissonLogSfGe(Math.floor(k) + 1, lam));
/** Smallest k with P(K > k) ≤ q (scipy's poisson.isf). */
export function poissonIsf(q, lam) {
  let k = Math.max(0, Math.floor(lam));
  while (k > 0 && poissonSf(k - 1, lam) <= q) k--;
  while (poissonSf(k, lam) > q) k++;
  return k;
}

export function binomLogPmf(k, n, p) {
  if (k < 0 || k > n) return -Infinity;
  if (p === 0) return k === 0 ? 0 : -Infinity;
  if (p === 1) return k === n ? 0 : -Infinity;
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k) + k * Math.log(p) + (n - k) * Math.log1p(-p);
}
export const binomPmf = (k, n, p) => Math.exp(binomLogPmf(k, n, p));

// ---------------------------------------------------------------- descriptive statistics

/** Max/min without spreading (spreading large arrays overflows the call stack). */
export function arrMax(a) {
  let m = -Infinity;
  for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i];
  return m;
}
export function arrMin(a) {
  let m = Infinity;
  for (let i = 0; i < a.length; i++) if (a[i] < m) m = a[i];
  return m;
}

export function mean(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return a.length ? s / a.length : NaN;
}
export function variance(a) {
  const m = mean(a);
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - m) ** 2;
  return a.length ? s / a.length : NaN;
}
export const std = (a) => Math.sqrt(variance(a));
export function quantile(a, q) {
  const s = Float64Array.from(a).sort();
  if (!s.length) return NaN;
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
export const median = (a) => quantile(a, 0.5);

/** Ordinary least squares y = a + b x; returns {slope, intercept}. */
export function linearFit(x, y) {
  const n = x.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxx += x[i] * x[i]; sxy += x[i] * y[i]; }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  return { slope, intercept: (sy - slope * sx) / n };
}
/** Least-squares line through (log10 x, log10 y), as np.polyfit(log10 x, log10 y, 1). */
export function logLogFit(x, y) {
  const lx = [], ly = [];
  for (let i = 0; i < x.length; i++) if (x[i] > 0 && y[i] > 0) { lx.push(Math.log10(x[i])); ly.push(Math.log10(y[i])); }
  return linearFit(lx, ly);
}

// ---------------------------------------------------------------- degree histograms

/**
 * A degree histogram {k: [...unique degrees ascending], count: [...]} is the compact form used throughout.
 * It is all the site needs from the large networks.
 */
export function histogram(values) {
  const m = new Map();
  for (const v of values) m.set(v, (m.get(v) || 0) + 1);
  const k = [...m.keys()].sort((a, b) => a - b);
  return { k, count: k.map((x) => m.get(x)) };
}
export function histTotal(h) {
  let n = 0;
  for (const c of h.count) n += c;
  return n;
}
export function histMoments(h) {
  let n = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < h.k.length; i++) { n += h.count[i]; s1 += h.count[i] * h.k[i]; s2 += h.count[i] * h.k[i] ** 2; }
  return { n, mean: s1 / n, k2: s2 / n, std: Math.sqrt(s2 / n - (s1 / n) ** 2), kmax: h.k[h.k.length - 1], kmin: h.k[0] };
}
/** Expand a histogram back into a list of values. */
export function histExpand(h) {
  const out = new Int32Array(histTotal(h));
  let p = 0;
  for (let i = 0; i < h.k.length; i++) for (let j = 0; j < h.count[i]; j++) out[p++] = h.k[i];
  return out;
}

/** Linear binning: p_k = N_k / N for every degree that occurs (the notebook's pk_linear). */
export function pkLinear(h) {
  const n = histTotal(h);
  return h.k.map((k, i) => [k, h.count[i] / n]);
}

/** Log-binned p_k (Advanced Topic 4.B), the notebook's pk_logbinned(): counts / (N · bin width). */
export function pkLogBinned(h, binsPerDecade = 6) {
  const ks = [], cs = [];
  for (let i = 0; i < h.k.length; i++) if (h.k[i] > 0) { ks.push(h.k[i]); cs.push(h.count[i]); }
  if (!ks.length) return [];
  let n = 0;
  for (const c of cs) n += c;
  const top = Math.log10(ks[ks.length - 1] + 1);
  const num = Math.floor(binsPerDecade * top) + 2;
  const edges = [];
  for (let i = 0; i < num; i++) {
    const e = Math.round(Math.pow(10, (top * i) / (num - 1)));
    if (!edges.length || e !== edges[edges.length - 1]) edges.push(e);
  }
  const counts = new Array(edges.length - 1).fill(0);
  let b = 0;
  for (let i = 0; i < ks.length; i++) {
    while (b < counts.length - 1 && ks[i] >= edges[b + 1]) b++;
    if (ks[i] >= edges[0]) counts[b] += cs[i];
  }
  const out = [];
  for (let i = 0; i < counts.length; i++) {
    if (!counts[i]) continue;
    const w = edges[i + 1] - edges[i];
    out.push([Math.sqrt(edges[i] * (edges[i + 1] - 1)), counts[i] / (n * w), { lo: edges[i], hi: edges[i + 1] - 1, count: counts[i] }]);
  }
  return out;
}

/** Complementary cumulative distribution P(K ≥ k) at every degree that occurs. */
export function ccdf(h) {
  const n = histTotal(h);
  const out = [];
  let above = n;
  for (let i = 0; i < h.k.length; i++) {
    out.push([h.k[i], above / n]);
    above -= h.count[i];
  }
  return out;
}

/** Keep the part of a histogram with k ≥ kmin. */
export function histTail(h, kmin) {
  const k = [], count = [];
  for (let i = 0; i < h.k.length; i++) if (h.k[i] >= kmin) { k.push(h.k[i]); count.push(h.count[i]); }
  return { k, count };
}

// ---------------------------------------------------------------- discrete power law

/** Discrete power-law log-likelihood ln L(γ) = −n ln ζ(γ, kmin) − γ Σ ln k_i, for a tail histogram. */
export function powerLawLogLik(gamma, tail, kmin) {
  let n = 0, sl = 0;
  for (let i = 0; i < tail.k.length; i++) { n += tail.count[i]; sl += tail.count[i] * Math.log(tail.k[i]); }
  return -n * Math.log(hurwitzZeta(gamma, kmin)) - gamma * sl;
}

/** The closed-form approximation γ̂ = 1 + n [Σ ln(k_i/(kmin − ½))]⁻¹ (accurate only for kmin ≳ 6). */
export function powerLawClosedForm(tail, kmin) {
  let n = 0, s = 0;
  for (let i = 0; i < tail.k.length; i++) { n += tail.count[i]; s += tail.count[i] * Math.log(tail.k[i] / (kmin - 0.5)); }
  return 1 + n / s;
}

/** Exact discrete MLE of γ by golden-section search of the (concave) log-likelihood on [lo, hi]. */
export function powerLawMLE(tail, kmin, { lo = 1.0001, hi = 10 } = {}) {
  let n = 0, sl = 0;
  for (let i = 0; i < tail.k.length; i++) { n += tail.count[i]; sl += tail.count[i] * Math.log(tail.k[i]); }
  const f = (g) => -n * Math.log(hurwitzZeta(g, kmin)) - g * sl;
  const phi = (Math.sqrt(5) - 1) / 2;
  let a = lo, b = hi, c = b - phi * (b - a), d = a + phi * (b - a);
  let fc = f(c), fd = f(d);
  for (let it = 0; it < 80 && b - a > 1e-7; it++) {
    if (fc > fd) { b = d; d = c; fd = fc; c = b - phi * (b - a); fc = f(c); }
    else { a = c; c = d; fc = fd; d = a + phi * (b - a); fd = f(d); }
  }
  const gamma = (a + b) / 2;
  return { gamma, n, sigma: (gamma - 1) / Math.sqrt(n), logLik: f(gamma) };
}

/**
 * Kolmogorov–Smirnov distance between a tail histogram and a discrete power law, using powerlaw's
 * convention: both CDFs are P(K < x), evaluated at the tail's distinct values.
 */
export function powerLawKS(tail, kmin, gamma) {
  const z0 = hurwitzZeta(gamma, kmin);
  let n = 0;
  for (const c of tail.count) n += c;
  let below = 0, D = 0;
  for (let i = 0; i < tail.k.length; i++) {
    const emp = below / n;
    const th = 1 - hurwitzZeta(gamma, tail.k[i]) / z0;
    D = Math.max(D, Math.abs(emp - th));
    below += tail.count[i];
  }
  return D;
}

/** P(K ≥ x | K ≥ kmin) for the discrete power law. */
export const powerLawCcdf = (x, gamma, kmin) => hurwitzZeta(gamma, x) / hurwitzZeta(gamma, kmin);

/**
 * Clauset–Shalizi–Newman fit: for each candidate kmin (every distinct degree but the largest), fit γ by
 * MLE on k ≥ kmin and compute the KS distance D; pick the kmin with the smallest D.
 * Returns the best fit plus the whole scan.
 */
export function fitPowerLaw(h, { maxGamma = 10, kmin: fixedKmin = null, maxCandidates = Infinity, minTail = 2, minTailCount = 0 } = {}) {
  const k = [], c = [];
  for (let i = 0; i < h.k.length; i++) if (h.k[i] > 0) { k.push(h.k[i]); c.push(h.count[i]); }
  const total = c.reduce((a, b) => a + b, 0);
  const candidates = fixedKmin != null ? [fixedKmin] : k.slice(0, Math.min(k.length - 1, maxCandidates));
  const scan = [];
  let best = null;
  // suffix structure: tail for candidate index i is k[i..], counts c[i..]
  for (const kmin of candidates) {
    const start = k.findIndex((x) => x >= kmin);
    if (start < 0) continue;
    const tail = { k: k.slice(start), count: c.slice(start) };
    const ntail = tail.count.reduce((a, b) => a + b, 0);
    if (fixedKmin == null && (tail.k.length < minTail || ntail < minTailCount)) continue;
    const fit = powerLawMLE(tail, kmin, { hi: maxGamma });
    const D = powerLawKS(tail, kmin, fit.gamma);
    const row = { kmin, gamma: fit.gamma, sigma: fit.sigma, D, ntail, tailShare: ntail / total, atBound: maxGamma - fit.gamma < 1e-4 };
    scan.push(row);
    if (!best || D < best.D) best = row;
  }
  return { ...best, scan };
}

/**
 * Goodness of fit (Clauset, Shalizi & Newman 2009, step 2): semi-parametric bootstrap. Each synthetic
 * data set has the same size n; a value is drawn from the fitted power law with probability n_tail/n,
 * otherwise resampled from the observed values below kmin. The full fit (including the choice of kmin)
 * is repeated on every synthetic set, and p = fraction of synthetic KS distances ≥ the observed one.
 * p ≥ 0.1: a power law is a plausible description of the tail; p < 0.1: it is ruled out.
 * Candidates for kmin with fewer than `minTailCount` tail points are skipped (they never win).
 */
export function* goodnessOfFit(h, fit, rng, { reps = 200, maxGamma = 10, minTailCount = 10 } = {}) {
  const body = [];
  let n = 0;
  for (let i = 0; i < h.k.length; i++) {
    if (h.k[i] <= 0) continue;
    n += h.count[i];
    if (h.k[i] < fit.kmin) for (let j = 0; j < h.count[i]; j++) body.push(h.k[i]);
  }
  const pTail = fit.ntail / n;
  const draw = discretePowerLawSampler(fit.gamma, fit.kmin);
  const Ds = [];
  let exceed = 0;
  for (let r = 0; r < reps; r++) {
    const m = new Map();
    for (let i = 0; i < n; i++) {
      const k = rng.random() < pTail || !body.length ? draw(rng) : body[Math.floor(rng.random() * body.length)];
      m.set(k, (m.get(k) || 0) + 1);
    }
    const ks = [...m.keys()].sort((a, b) => a - b);
    const synth = fitPowerLaw({ k: ks, count: ks.map((k) => m.get(k)) }, { maxGamma, minTailCount });
    Ds.push(synth.D);
    if (synth.D >= fit.D) exceed++;
    yield { done: r + 1, reps, p: exceed / (r + 1) };
  }
  return { p: exceed / reps, reps, Ds };
}

/** Discrete exponential on k ≥ kmin, p(k) = (1 − e^−λ) e^(−λ(k − kmin)); MLE λ = ln(1 + 1/(⟨k⟩ − kmin)). */
export function exponentialMLE(tail, kmin) {
  let n = 0, s = 0;
  for (let i = 0; i < tail.k.length; i++) { n += tail.count[i]; s += tail.count[i] * tail.k[i]; }
  const m = s / n - kmin;
  return { lambda: m > 0 ? Math.log(1 + 1 / m) : 50, n };
}

/**
 * Normalised log-likelihood ratio test (Vuong), power law vs. discrete exponential:
 * R > 0 favours the power law; p < 0.1 means the sign of R is significant.
 */
export function compareWithExponential(tail, kmin, gamma) {
  const { lambda } = exponentialMLE(tail, kmin);
  const lz = Math.log(hurwitzZeta(gamma, kmin));
  const lnorm = Math.log(1 - Math.exp(-lambda));
  let n = 0, s = 0, s2 = 0;
  for (let i = 0; i < tail.k.length; i++) {
    const x = tail.k[i], cnt = tail.count[i];
    const d = (-gamma * Math.log(x) - lz) - (lnorm - lambda * (x - kmin));
    n += cnt; s += cnt * d; s2 += cnt * d * d;
  }
  const mu = s / n, sd = Math.sqrt(Math.max(1e-300, s2 / n - mu * mu));
  const R = s / (Math.sqrt(n) * sd);
  return { R, p: erfc(Math.abs(s) / Math.sqrt(2 * n * sd * sd)), lambda };
}

// ---------------------------------------------------------------- sampling degree sequences

/**
 * Exact sampler for the discrete power law p_k = k^−γ / ζ(γ, kmin), k ≥ kmin.
 * Inversion on a table of P(K ≥ k) for the first `table` degrees; beyond that the rounding
 * approximation is exact to many digits (it is only inaccurate for small k).
 */
export function discretePowerLawSampler(gamma, kmin, { table = 20000 } = {}) {
  const z0 = hurwitzZeta(gamma, kmin);
  const S = new Float64Array(table + 1);
  S[0] = 1;
  for (let i = 0; i < table; i++) S[i + 1] = S[i] - Math.pow(kmin + i, -gamma) / z0;
  const kc = kmin + table, Sc = hurwitzZeta(gamma, kc) / z0, e = -1 / (gamma - 1);
  return (rng) => {
    const u = 1 - rng.random(); // in (0, 1]
    if (u <= Sc) return Math.floor((kc - 0.5) * Math.pow(u / Sc, e) + 0.5);
    let lo = 0, hi = table - 1; // largest i with S[i] >= u
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (S[mid] >= u) lo = mid; else hi = mid - 1;
    }
    return kmin + lo;
  };
}

/**
 * Discrete power-law sample. method "exact" (default) samples p_k ∝ k^−γ exactly; method "round" is
 * the rounding approximation k = ⌊(kmin − ½)(1 − u)^(−1/(γ−1)) + ½⌋ used by the notebook's helper,
 * which is biased for kmin ≲ 6 (at kmin = 1 the sample's MLE is ≈ 2.76 for γ = 2.5).
 */
export function samplePowerLaw(n, gamma, kmin, rng, { kmax = Infinity, method = "exact" } = {}) {
  const out = new Int32Array(n);
  if (method === "round") {
    const e = -1 / (gamma - 1);
    for (let i = 0; i < n; i++) out[i] = Math.min(Math.floor((kmin - 0.5) * Math.pow(1 - rng.random(), e) + 0.5), kmax);
    return out;
  }
  const draw = discretePowerLawSampler(gamma, kmin);
  for (let i = 0; i < n; i++) out[i] = Math.min(draw(rng), kmax);
  return out;
}

/** Continuous power-law sample x ≥ xmin (used for k_max and moment scaling). */
export function sampleContinuousPowerLaw(n, gamma, xmin, rng) {
  const out = new Float64Array(n);
  const e = -1 / (gamma - 1);
  for (let i = 0; i < n; i++) out[i] = xmin * Math.pow(1 - rng.random(), e);
  return out;
}

// ---------------------------------------------------------------- random-network theory

/** Fraction S of nodes in the giant component of G(N, p): solution of S = 1 − exp(−⟨k⟩ S). */
export function giantComponentFraction(avgk) {
  if (avgk <= 1) return 0;
  let S = 1;
  for (let i = 0; i < 2000; i++) {
    const next = 1 - Math.exp(-avgk * S);
    if (Math.abs(next - S) < 1e-13) return next;
    S = next;
  }
  return S;
}

/** Expected largest degree of a random network, from N · P(K > k_max) = 1 (Advanced Topic 3.B). */
export const poissonKmax = (N, avgk) => poissonIsf(1 / N, avgk);

/** Nice number formatting helpers shared by pages. */
export const fmt = {
  int: (x) => (x == null || !Number.isFinite(x) ? "–" : Math.round(x).toLocaleString("en-US")),
  fix: (x, d = 2) => (x == null || !Number.isFinite(x) ? "–" : x.toFixed(d)),
  sig: (x, d = 3) => {
    if (x == null || !Number.isFinite(x)) return "–";
    if (x === 0) return "0";
    const a = Math.abs(x);
    if (a >= 1e5 || a < 1e-3) return fmt.exp(x, d - 1);
    return Number(x.toPrecision(d)).toLocaleString("en-US", { maximumSignificantDigits: d });
  },
  exp: (x, d = 1) => {
    if (x == null || !Number.isFinite(x)) return "–";
    if (x === 0) return "0";
    const e = Math.floor(Math.log10(Math.abs(x)));
    const m = x / Math.pow(10, e);
    const ms = m.toFixed(d);
    return (ms === "1" || ms === "1.0" ? "" : ms + "×") + "10" + superscript(e);
  },
  pct: (x, d = 1) => (x == null || !Number.isFinite(x) ? "–" : (100 * x).toFixed(d) + "%"),
};

const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export const superscript = (n) => String(n).split("").map((c) => SUP[c] ?? c).join("");
