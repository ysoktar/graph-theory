// Loading the precomputed data (see tools/preprocess.py). All paths are relative to the site root.
import { CSRGraph, Graph } from "./graph.js";

const cache = new Map();
function once(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

export const loadJSON = (path) => once(path, async () => {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Could not load ${path} (${r.status})`);
  return r.json();
});

/** {meta, networks: {name: summary}} for the eight reference networks of the book's Table 4.1. */
export const loadNetworks = () => loadJSON("data/networks.json");
export const loadSamples = () => loadJSON("data/samples.json");
export const loadClassic = () => loadJSON("data/classic.json");
export const loadCollabExtra = () => loadJSON("data/collaboration-extra.json");

/** Order and short labels used everywhere. */
export const NETWORK_ORDER = ["metabolic", "protein", "powergrid", "collaboration", "phonecalls", "email", "internet", "www"];
export const SHORT = {
  metabolic: "Metabolic", protein: "Protein", powergrid: "Power grid", collaboration: "Collaboration",
  phonecalls: "Phone calls", email: "Email", internet: "Internet", www: "WWW",
};
/** Networks whose full edge list ships with the site (the two largest only come as summaries). */
export const WITH_EDGES = ["metabolic", "protein", "powergrid", "collaboration", "phonecalls", "email"];

/** Full edge list of a real network as a CSRGraph (uint16 pairs, see preprocess.py). */
export const loadRealGraph = (name) => once("edges:" + name, async () => {
  const { networks } = await loadNetworks();
  const meta = networks[name];
  if (!meta.edgeFile) throw new Error(`${name} is only available as a summary`);
  const r = await fetch("data/" + meta.edgeFile);
  if (!r.ok) throw new Error(`Could not load ${meta.edgeFile}`);
  const pairs = new Uint16Array(await r.arrayBuffer());
  return CSRGraph.fromPairs(meta.N, Int32Array.from(pairs));
});

export async function karateGraph() {
  const { karate } = await loadClassic();
  const g = Graph.fromEdges(karate.nodes.length, karate.edges.map(([u, v]) => [u, v]));
  return { graph: g, club: karate.nodes.map((v) => v.club), weights: karate.edges };
}

/** A sample of a real network for drawing: {graph, degree (in the full network)}. */
export async function sampleGraph(name) {
  const s = (await loadSamples())[name];
  return { graph: Graph.fromEdges(s.n, s.edges), fullDegree: s.degree };
}
