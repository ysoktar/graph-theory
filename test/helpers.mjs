import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Graph } from "../site/js/lib/graph.js";

export const root = join(import.meta.dirname, "..");
export const readJSON = (...p) => JSON.parse(readFileSync(join(root, ...p), "utf8"));
export const ref = readJSON("test", "fixtures", "reference.json");

export function karate() {
  const { karate } = readJSON("site", "data", "classic.json");
  return Graph.fromEdges(karate.nodes.length, karate.edges.map(([u, v]) => [u, v]));
}

export function close(actual, expected, tol, msg = "") {
  if (!(Math.abs(actual - expected) <= tol)) {
    throw new Error(`${msg} expected ${expected} ± ${tol}, got ${actual}`);
  }
}
