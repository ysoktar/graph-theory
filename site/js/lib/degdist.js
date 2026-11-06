// Degree distributions to choose from in a dropdown, and what follows from them for a randomly wired network
// (configuration model): moments, κ = ⟨k²⟩/⟨k⟩, the random-failure threshold f_c = 1 − 1/(κ − 1), the attack
// threshold, and the giant component under random failures or attacks, solved exactly with generating functions
// (Callaway, Newman, Strogatz & Watts 2000; Cohen, Erez, ben-Avraham & Havlin 2001).

const lgamma = (x) => {
  // Lanczos approximation, good to ~1e-13 for x > 0
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
};

/** The distributions offered, with their parameters (value, min, max, step) and formula. */
export const DISTRIBUTIONS = {
  poisson: { label: "Poisson (random network)", tex: "p_k = e^{-\\langle k\\rangle}\\langle k\\rangle^k/k!",
    params: { mean: [4, 0.5, 20, 0.1, "⟨k⟩"] } },
  powerlaw: { label: "Power law", tex: "p_k \\propto k^{-\\gamma},\\ k_{\\min} \\le k \\le k_{\\max} = k_{\\min} N^{1/(\\gamma-1)}",
    params: { gamma: [2.5, 2.05, 4.5, 0.05, "γ"], kmin: [2, 1, 6, 1, "k_min"], logN: [4, 2, 7, 0.5, "log₁₀ N"] } },
  cutoff: { label: "Power law with exponential cutoff", tex: "p_k \\propto k^{-\\gamma} e^{-k/\\kappa_c},\\ k \\ge k_{\\min}",
    params: { gamma: [2.5, 1.5, 4.5, 0.05, "γ"], kmin: [2, 1, 6, 1, "k_min"], kc: [50, 5, 1000, 5, "cutoff k_c"] } },
  exponential: { label: "Exponential (growth without preferential attachment)", tex: "p_k \\propto e^{-k/\\lambda},\\ k \\ge k_{\\min}",
    params: { lambda: [3, 0.5, 20, 0.1, "scale λ"], kmin: [1, 1, 6, 1, "k_min"] } },
  lognormal: { label: "Log-normal", tex: "p_k \\propto \\frac{1}{k}\\exp\\!\\Big(-\\frac{(\\ln k-\\mu)^2}{2\\sigma^2}\\Big)",
    params: { mu: [1.2, 0, 4, 0.05, "μ"], sigma: [0.8, 0.1, 2, 0.05, "σ"] } },
  regular: { label: "Regular (every node has degree k)", tex: "p_k = \\delta_{k,k_0}",
    params: { k0: [3, 1, 20, 1, "k₀"] } },
  bimodal: { label: "Bimodal (a few hubs, the rest equal)", tex: "p_k = (1-r)\\,\\delta_{k,k_{\\min}} + r\\,\\delta_{k,k_{\\max}}",
    params: { kmin: [3, 1, 10, 1, "k_min"], kmax: [100, 10, 1000, 10, "k_max"], r: [0.01, 0.001, 0.2, 0.001, "hub share r"] } },
};

/** p[k] for k = 0..K, normalised. */
export function pmf(type, p) {
  const out = [];
  const fill = (kFrom, kTo, w) => { for (let k = kFrom; k <= kTo; k++) out[k] = w(k); };
  switch (type) {
    case "poisson": { const K = Math.ceil(p.mean + 12 * Math.sqrt(p.mean) + 20); fill(0, K, (k) => Math.exp(-p.mean + k * Math.log(p.mean) - lgamma(k + 1))); break; }
    case "powerlaw": { const N = Math.pow(10, p.logN); const K = Math.min(Math.round(p.kmin * Math.pow(N, 1 / (p.gamma - 1))), Math.round(N - 1), 200000); fill(0, K, (k) => (k >= p.kmin ? Math.pow(k, -p.gamma) : 0)); break; }
    case "cutoff": { const K = Math.ceil(p.kc * 40 + p.kmin + 20); fill(0, Math.min(K, 200000), (k) => (k >= p.kmin ? Math.pow(k, -p.gamma) * Math.exp(-k / p.kc) : 0)); break; }
    case "exponential": { const K = Math.ceil(p.kmin + p.lambda * 40); fill(0, K, (k) => (k >= p.kmin ? Math.exp(-k / p.lambda) : 0)); break; }
    case "lognormal": { const K = Math.ceil(Math.exp(p.mu + 8 * p.sigma)) + 5; fill(0, Math.min(K, 200000), (k) => (k >= 1 ? Math.exp(-((Math.log(k) - p.mu) ** 2) / (2 * p.sigma ** 2)) / k : 0)); break; }
    case "regular": fill(0, p.k0, (k) => (k === p.k0 ? 1 : 0)); break;
    case "bimodal": fill(0, p.kmax, (k) => (k === p.kmin ? 1 - p.r : 0) + (k === p.kmax ? p.r : 0)); break;
    default: throw new Error("unknown distribution " + type);
  }
  const s = out.reduce((a, b) => a + b, 0);
  return Float64Array.from(out, (x) => x / s);
}

/** ⟨k⟩, ⟨k²⟩, κ, k_max with p_k > 0, and the share of nodes at the smallest degrees. */
export function moments(pk) {
  let m1 = 0, m2 = 0, kmax = 0;
  for (let k = 0; k < pk.length; k++) { m1 += k * pk[k]; m2 += k * k * pk[k]; if (pk[k] > 1e-15) kmax = k; }
  return { m1, m2, kappa: m2 / m1, sigma: Math.sqrt(Math.max(0, m2 - m1 * m1)), kmax };
}

/** Random-failure threshold f_c = 1 − 1/(κ − 1) (0 if there is no giant component to begin with). */
export const fcRandom = (kappa) => (kappa > 2 ? 1 - 1 / (kappa - 1) : 0);

/**
 * Giant component of a configuration-model network in which a node of degree k is kept with probability phi[k]
 * (site percolation): solve u = 1 − F₁(1) + F₁(u), S = F₀(1) − F₀(u), with F₀(x) = Σ p_k φ_k x^k and
 * F₁(x) = Σ k p_k φ_k x^{k−1} / ⟨k⟩. Returns S as a share of all original nodes.
 */
export function giantKept(pk, phi) {
  const m1 = pk.reduce((a, p, k) => a + k * p, 0);
  let F1one = 0;
  for (let k = 1; k < pk.length; k++) F1one += k * pk[k] * phi(k);
  F1one /= m1;
  if (F1one <= 0) return 0;
    let u = 0;
  for (let it = 0; it < 600; it++) {
    let f1 = 0, xp = 1; // x^{k-1}
    for (let k = 1; k < pk.length; k++) { if (pk[k]) f1 += k * pk[k] * phi(k) * xp; xp *= u; if (xp < 1e-300) break; }
    const nu = 1 - F1one + f1 / m1;
    if (Math.abs(nu - u) < 1e-10) { u = nu; break; }
    u = nu;
  }
  let S = 0, xp = 1;
  for (let k = 0; k < pk.length; k++) { if (pk[k]) S += pk[k] * phi(k) * (1 - xp); xp *= u; }
  return Math.max(0, S);
}

/** Keep-probabilities for an attack that removes the fraction f of highest-degree nodes (ties split). */
export function attackPhi(pk, f) {
  let tail = 0, K = pk.length - 1;
  while (K > 0 && tail + pk[K] <= f) { tail += pk[K]; K--; }
  const partial = pk[K] > 0 ? 1 - (f - tail) / pk[K] : 1; // share of degree-K nodes that survive
  return (k) => (k < K ? 1 : k === K ? partial : 0);
}

/** Giant component after removing f at random, or the top f by degree. */
export const giantRandom = (pk, f) => giantKept(pk, () => 1 - f);
export const giantAttack = (pk, f) => giantKept(pk, attackPhi(pk, f));

/**
 * Exact attack threshold: the giant component of the kept nodes exists while Σ_k k(k−1) p_k φ_k > ⟨k⟩
 * (the same criterion as Molloy–Reed, applied to what survives). Removing the top degrees lowers the sum.
 */
export function fcAttack(pk) {
  const m1 = pk.reduce((a, p, k) => a + k * p, 0);
  let s = 0;
  for (let k = 2; k < pk.length; k++) s += k * (k - 1) * pk[k];
  if (s <= m1) return 0;
  let f = 0;
  for (let k = pk.length - 1; k >= 2; k--) {
    const w = k * (k - 1) * pk[k];
    if (s - w <= m1) return f + (pk[k] * (s - m1)) / w; // remove only part of the degree-k nodes
    s -= w; f += pk[k];
  }
  return f;
}

/**
 * The book's attack threshold for a pure power law (Eq. 8.12, Cohen et al. 2001), continuum approximation:
 * f^((2−γ)/(1−γ)) = 2 + (2−γ)/(3−γ) k_min (f^((3−γ)/(1−γ)) − 1). Returns the root in (0, 1), or NaN.
 */
export function fcAttackPowerLaw(gamma, kmin) {
  const a = (2 - gamma) / (1 - gamma), b = (3 - gamma) / (1 - gamma), c = (2 - gamma) / (3 - gamma);
  const g = (f) => Math.pow(f, a) - 2 - c * kmin * (Math.pow(f, b) - 1);
  // g(1) = −1 < 0; scan from small f for a sign change
  let prev = 1e-9, gp = g(prev);
  for (let i = 1; i <= 2000; i++) {
    const f = Math.pow(10, -9 + (9 * i) / 2000);
    const gf = g(f);
    if (gp > 0 && gf <= 0) { let lo = prev, hi = f; for (let j = 0; j < 60; j++) { const m = (lo + hi) / 2; if (g(m) > 0) lo = m; else hi = m; } return (lo + hi) / 2; }
    prev = f; gp = gf;
  }
  return NaN;
}

/**
 * The book's random-failure threshold for a pure power law in the continuum approximation (Eq. 8.9), keeping
 * k_max = k_min N^(1/(γ−1)) finite in both moments, so the curve stays smooth through γ = 3:
 * ⟨k⟩ ∝ (k_min^(2−γ) − k_max^(2−γ))/(γ−2), ⟨k²⟩ ∝ (k_max^(3−γ) − k_min^(3−γ))/(3−γ). Eq. (8.9) is its large-N limit.
 */
export function fcRandomPowerLaw(gamma, kmin, N) {
  const kmax = kmin * Math.pow(N, 1 / (gamma - 1));
  const I = (a) => (Math.abs(a) < 1e-9 ? Math.log(kmax / kmin) : (Math.pow(kmax, a) - Math.pow(kmin, a)) / a); // ∫ k^(a−1) dk
  const kappa = I(3 - gamma) / I(2 - gamma);
  return { kappa, fc: fcRandom(kappa) };
}
