// A small graph editor on top of NetView: click empty space to add a node, click two nodes to
// link/unlink them, drag to move, Delete to remove the selected node. Optional directed mode.
import { NetView } from "./netview.js";
import { Graph } from "./graph.js";

export class GraphEditor {
  /** opts: {height, directed, onChange(editor), nodeColor(i, editor), label(i, editor), hint} */
  constructor(parent, opts = {}) {
    this.opts = opts;
    this.directed = !!opts.directed;
    this.pos = [];
    this.arcs = []; // [u, v]; in undirected mode each pair appears once
    this.selected = -1;
    this.view = new NetView(parent, {
      height: opts.height || 340, fit: false, toolbar: false, zoom: false, directed: this.directed,
      hint: opts.hint ?? "Click empty space to add a node · click two nodes to link them · drag to move",
      nodeRadius: () => 11,
      nodeColor: (i) => (opts.nodeColor ? opts.nodeColor(i, this) : "s1"),
      nodeRing: (i) => (i === this.selected ? "text" : null),
      edgeColor: (u, v, e) => (opts.edgeColor ? opts.edgeColor(u, v, e, this) : "muted"),
      edgeWidth: () => 2,
      label: (i) => (opts.label ? opts.label(i, this) : String(i)),
      labelInside: () => true,
      tooltip: (i) => this.describe(i),
      onClick: (i) => this.clickNode(i),
      onBackgroundClick: (p) => this.addNode(p.x, p.y),
    });
    this.view.root.tabIndex = 0;
    this.view.root.addEventListener("keydown", (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") && this.selected >= 0) { e.preventDefault(); this.deleteNode(this.selected); }
      if (e.key === "Escape") { this.selected = -1; this.view.redraw(); }
    });
  }

  get n() { return this.pos.length; }

  degrees() {
    const k = new Array(this.n).fill(0), kin = new Array(this.n).fill(0), kout = new Array(this.n).fill(0);
    for (const [u, v] of this.arcs) { k[u]++; k[v]++; kout[u]++; kin[v]++; }
    return { k, kin, kout };
  }

  graph() {
    return Graph.fromEdges(this.n, this.arcs);
  }

  describe(i) {
    const d = this.degrees();
    return this.directed ? `node ${i}: k_in = ${d.kin[i]}, k_out = ${d.kout[i]}, k = ${d.k[i]}` : `node ${i}: degree k = ${d.k[i]}`;
  }

  _sync() {
    // keep the positions the user dragged
    this.view.nodes.forEach((d, i) => { if (this.pos[i]) this.pos[i] = [d.x, d.y]; });
  }

  _render() {
    this.view.opts.directed = this.directed;
    this.view.setGraph({ n: this.n, edges: this.arcs.map((a) => a.slice()) }, { positions: this.pos });
    this.opts.onChange && this.opts.onChange(this);
  }

  addNode(x, y) {
    this._sync();
    this.pos.push([x, y]);
    this.selected = -1;
    this._render();
  }

  deleteNode(v) {
    this._sync();
    this.pos.splice(v, 1);
    this.arcs = this.arcs.filter(([a, b]) => a !== v && b !== v).map(([a, b]) => [a > v ? a - 1 : a, b > v ? b - 1 : b]);
    this.selected = -1;
    this._render();
  }

  clickNode(i) {
    this._sync();
    if (this.selected < 0) { this.selected = i; this.view.redraw(); return; }
    if (this.selected === i) { this.selected = -1; this.view.redraw(); return; }
    this.toggle(this.selected, i);
    this.selected = -1;
    this._render();
  }

  toggle(u, v) {
    const same = this.directed ? (a) => a[0] === u && a[1] === v : (a) => (a[0] === u && a[1] === v) || (a[0] === v && a[1] === u);
    const i = this.arcs.findIndex(same);
    if (i >= 0) this.arcs.splice(i, 1);
    else this.arcs.push([u, v]);
  }

  setDirected(d) {
    this._sync();
    this.directed = d;
    if (!d) {
      // collapse u→v and v→u into one undirected link
      const seen = new Set();
      this.arcs = this.arcs.filter(([a, b]) => { const k = Math.min(a, b) + "," + Math.max(a, b); if (seen.has(k)) return false; seen.add(k); return true; });
    }
    this._render();
  }

  /** Load positions in [0, 1]² (scaled to the canvas) and links. */
  load(unitPositions, arcs) {
    const W = this.view.W, H = this.view.H, m = 34;
    this.pos = unitPositions.map(([x, y]) => [m + x * (W - 2 * m), m + 18 + y * (H - 2 * m - 18)]);
    this.arcs = arcs.map((a) => a.slice());
    this.selected = -1;
    this._render();
  }

  deleteSelected() { if (this.selected >= 0) this.deleteNode(this.selected); }
}

/** Preset small graphs with positions in the unit square. */
export const PRESETS = {
  empty: () => ({ pos: [], edges: [] }),
  triangle: () => ({ pos: [[0.5, 0.1], [0.2, 0.85], [0.8, 0.85]], edges: [[0, 1], [1, 2], [2, 0]] }),
  star: () => ({ pos: [[0.5, 0.5], ...circ(6, 0.42)], edges: [1, 2, 3, 4, 5, 6].map((v) => [0, v]) }),
  path: () => ({ pos: Array.from({ length: 6 }, (_, i) => [i / 5, 0.5 + (i % 2 ? 0.12 : -0.12)]), edges: [0, 1, 2, 3, 4].map((v) => [v, v + 1]) }),
  ring: () => ({ pos: circ(7, 0.45), edges: Array.from({ length: 7 }, (_, i) => [i, (i + 1) % 7]) }),
  complete: () => { const e = []; for (let u = 0; u < 5; u++) for (let v = u + 1; v < 5; v++) e.push([u, v]); return { pos: circ(5, 0.45), edges: e }; },
  example: () => ({
    pos: [[0.12, 0.2], [0.38, 0.1], [0.32, 0.62], [0.6, 0.45], [0.85, 0.15], [0.88, 0.8], [0.55, 0.95]],
    edges: [[0, 1], [0, 2], [1, 2], [2, 3], [3, 4], [3, 5], [5, 6], [3, 6]],
  }),
};
function circ(n, r) {
  return Array.from({ length: n }, (_, i) => [0.5 + r * Math.cos((2 * Math.PI * i) / n - Math.PI / 2), 0.5 + r * Math.sin((2 * Math.PI * i) / n - Math.PI / 2)]);
}
