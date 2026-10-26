// Small dense linear algebra for the embeddings page (networks of a few hundred nodes at most).

/**
 * Eigen-decomposition of a symmetric n×n matrix (row-major Float64Array) by cyclic Jacobi rotations.
 * Returns {values, vectors} with values ascending and vectors[j] the unit eigenvector of values[j].
 * `tol` bounds the sum of squared off-diagonal entries.
 */
export function symmetricEigen(M, n, { tol = 1e-24, maxSweeps = 100 } = {}) {
  const a = Float64Array.from(M), v = new Float64Array(n * n);
  for (let i = 0; i < n; i++) v[i * n + i] = 1;
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p * n + q] ** 2;
    if (off < tol) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      const apq = a[p * n + q];
      if (Math.abs(apq) < 1e-300) continue;
      const theta = (a[q * n + q] - a[p * n + p]) / (2 * apq);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { // rotate columns p, q
        const akp = a[k * n + p], akq = a[k * n + q];
        a[k * n + p] = c * akp - s * akq; a[k * n + q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) { // rotate rows p, q
        const apk = a[p * n + k], aqk = a[q * n + k];
        a[p * n + k] = c * apk - s * aqk; a[q * n + k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = v[k * n + p], vkq = v[k * n + q];
        v[k * n + p] = c * vkp - s * vkq; v[k * n + q] = s * vkp + c * vkq;
      }
    }
  }
  const idx = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[i * n + i] - a[j * n + j]);
  return { values: idx.map((i) => a[i * n + i]), vectors: idx.map((j) => Float64Array.from({ length: n }, (_, k) => v[k * n + j])) };
}

/** Dense adjacency matrix of a graph. */
export function adjacencyMatrix(g) {
  const n = g.n, A = new Float64Array(n * n);
  for (const [u, v] of g.edges()) { A[u * n + v] = 1; A[v * n + u] = 1; }
  return A;
}

/** Symmetric normalised Laplacian I − D^{-1/2} A D^{-1/2}. */
export function normalizedLaplacian(g) {
  const n = g.n, A = adjacencyMatrix(g), d = g.degrees(), L = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) L[i * n + j] = (i === j && d[i] ? 1 : 0) - (d[i] && d[j] ? A[i * n + j] / Math.sqrt(d[i] * d[j]) : 0);
  return L;
}

/**
 * DeepWalk as matrix factorisation (Qiu et al., WSDM 2018): with window T and b negative samples,
 * M = log max(1, vol(G)/(bT) Σ_{r=1..T} (D⁻¹A)^r D⁻¹). The embedding is U_d |Λ_d|^{1/2} of M's top eigenpairs.
 */
export function deepwalkMatrix(g, T = 5, b = 1) {
  const n = g.n, A = adjacencyMatrix(g), d = g.degrees();
  let vol = 0;
  for (const x of d) vol += x;
  const P = new Float64Array(n * n); // D⁻¹A
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) P[i * n + j] = d[i] ? A[i * n + j] / d[i] : 0;
  let Pr = Float64Array.from(P);
  const S = Float64Array.from(P);
  for (let r = 2; r <= T; r++) {
    const next = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) { const x = Pr[i * n + k]; if (!x) continue; for (let j = 0; j < n; j++) next[i * n + j] += x * P[k * n + j]; }
    Pr = next;
    for (let i = 0; i < n * n; i++) S[i] += Pr[i];
  }
  const M = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) M[i * n + j] = Math.log(Math.max(1, (vol / (b * T)) * (d[j] ? S[i * n + j] / d[j] : 0)));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const m = (M[i * n + j] + M[j * n + i]) / 2; M[i * n + j] = M[j * n + i] = m; }
  return M;
}
