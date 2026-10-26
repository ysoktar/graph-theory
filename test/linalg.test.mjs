import { test } from "node:test";
import assert from "node:assert/strict";
import { symmetricEigen, normalizedLaplacian } from "../site/js/lib/linalg.js";
import { Graph } from "../site/js/lib/graph.js";

test("Jacobi eigen-decomposition reproduces A v = λ v", () => {
  const n = 5, M = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) M[i * n + j] = M[j * n + i] = Math.sin(i * 3 + j * 7) + (i === j ? 3 : 0);
  const { values, vectors } = symmetricEigen(M, n);
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += M[i * n + j] * vectors[k][j];
    assert.ok(Math.abs(s - values[k] * vectors[k][i]) < 1e-9);
  }
  for (let k = 1; k < n; k++) assert.ok(values[k] >= values[k - 1]);
});

test("normalised Laplacian of two disconnected triangles has two zero eigenvalues", () => {
  const g = Graph.fromEdges(6, [[0, 1], [1, 2], [0, 2], [3, 4], [4, 5], [3, 5]]);
  const { values } = symmetricEigen(normalizedLaplacian(g), 6);
  assert.ok(Math.abs(values[0]) < 1e-9 && Math.abs(values[1]) < 1e-9 && values[2] > 0.5);
  assert.ok(Math.abs(values[5] - 1.5) < 1e-9); // triangle: eigenvalues 0, 1.5, 1.5
});
