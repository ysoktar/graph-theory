// Canvas network view with a d3-force layout. Styling is done through accessor functions that read
// the page's state, so a page changes what is shown by updating its state and calling view.redraw().
import { h, color, onThemeChange, tooltip } from "./ui.js";

const d3 = () => window.d3;

export class NetView {
  /**
   * opts: {height, nodeRadius(i), nodeColor(i) → token, nodeRing(i) → token|null, nodeOpacity(i),
   *        edgeColor(u, v, e) → token|null (null hides), edgeWidth(u, v, e), edgeOpacity,
   *        label(i) → string|null, tooltip(i) → Node|string, onClick(i, ev), onBackgroundClick({x, y}, ev),
   *        onHover(i|null), drag, zoom, charge, linkDistance, gravity, collide, directed,
   *        legend: [{label, color}], hint, toolbar, beforeNodes(ctx, api), afterNodes(ctx, api), ariaLabel}
   */
  constructor(parent, opts = {}) {
    this.opts = {
      height: 420, nodeRadius: () => 5, nodeColor: () => "s1", edgeColor: () => "axis", edgeWidth: () => 1,
      edgeOpacity: 1, drag: true, zoom: true, charge: -40, linkDistance: 28, gravity: 0.07, collide: 0,
      toolbar: true, fit: true, ...opts,
    };
    this.root = h("div", { class: "netview" });
    this.canvas = h("canvas", { role: "img", "aria-label": opts.ariaLabel || "Network diagram" });
    this.root.append(this.canvas);
    if (this.opts.hint) this.hintEl = this.root.appendChild(h("div", { class: "nv-hint" }, this.opts.hint));
    if (this.opts.toolbar) {
      const bar = h("div", { class: "nv-toolbar" });
      bar.append(
        h("button", { class: "btn", type: "button", title: "Shake the layout", onclick: () => this.relayout() }, "Re-layout"),
        h("button", { class: "btn", type: "button", title: "Zoom to fit", onclick: () => { this.userZoomed = false; this.fit(true); } }, "Fit"),
      );
      this.root.append(bar);
    }
    this.legendEl = h("div", { class: "nv-legend" });
    this.root.append(this.legendEl);
    if (this.opts.legend) this.setLegend(this.opts.legend);
    (typeof parent === "string" ? document.querySelector(parent) : parent).append(this.root);

    this.ctx = this.canvas.getContext("2d");
    this.transform = { k: 1, x: 0, y: 0 };
    this.userZoomed = false;
    this.nodes = [];
    this.links = [];
    this.n = 0;
    this.hover = -1;
    this.tip = tooltip();
    this._raf = 0;
    this._resize();
    this.ro = new ResizeObserver(() => { this._resize(); this.fit(); this.redraw(); });
    this.ro.observe(this.root);
    onThemeChange(() => this.redraw());

    const D3 = d3();
    this.sim = D3.forceSimulation([]).stop()
      .force("link", D3.forceLink([]).distance(this.opts.linkDistance))
      .force("charge", D3.forceManyBody().strength(this.opts.charge).distanceMax(400).theta(0.9))
      .force("x", D3.forceX(0).strength(this.opts.gravity))
      .force("y", D3.forceY(0).strength(this.opts.gravity))
      .on("tick", () => { if (this.opts.fit && !this.userZoomed) this.fit(); this.redraw(); });
    if (this.opts.collide) this.sim.force("collide", D3.forceCollide((d) => this.opts.nodeRadius(d.index) + this.opts.collide));
    this._bindEvents();
  }

  setLegend(items) {
    this.legendEl.replaceChildren(...(items || []).map((it) => {
      const i = h("i", { style: { background: `var(--${typeof it.color === "number" ? "s" + it.color : it.color})` } });
      return h("span", {}, i, it.label);
    }));
    this.legendEl.style.display = items && items.length ? "" : "none";
  }

  _resize() {
    const W = this.root.clientWidth || 600;
    const H = typeof this.opts.height === "function" ? this.opts.height(W) : this.opts.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = W; this.H = H; this.dpr = dpr;
    this.root.style.height = H + "px";
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.height = H + "px";
  }

  /**
   * Show a graph. g: Graph | CSRGraph | {n, edges}. options:
   *   positions: [[x, y], …] fixed layout (no simulation) · keep: reuse current node positions
   *   alpha: simulation heat · seedPositions: initial positions for the force layout
   */
  setGraph(g, { positions = null, keep = true, alpha = 1, seedPositions = null } = {}) {
    const n = g.n;
    const edges = g.edges ? (Array.isArray(g.edges) ? g.edges : g.edges()) : [];
    const old = this.nodes;
    const nodes = new Array(n);
    const R = 30 * Math.sqrt(n);
    for (let i = 0; i < n; i++) {
      if (keep && old[i]) { nodes[i] = old[i]; nodes[i].index = i; continue; }
      const sp = seedPositions && seedPositions[i];
      nodes[i] = { index: i, x: sp ? sp[0] : (Math.random() - 0.5) * R, y: sp ? sp[1] : (Math.random() - 0.5) * R, vx: 0, vy: 0 };
    }
    // new nodes appear next to a neighbour that already has a position
    if (keep && old.length && n > old.length) {
      const nb = new Map();
      for (const [u, v] of edges) { if (u < old.length && v >= old.length) nb.set(v, u); if (v < old.length && u >= old.length) nb.set(u, v); }
      for (let i = old.length; i < n; i++) if (nb.has(i)) { const p = nodes[nb.get(i)]; nodes[i].x = p.x + (Math.random() - 0.5) * 20; nodes[i].y = p.y + (Math.random() - 0.5) * 20; }
    }
    this.nodes = nodes;
    this.n = n;
    this.edgeList = edges;
    this.links = edges.map(([u, v], e) => ({ source: u, target: v, index: e }));
    this.fixed = !!positions;
    if (positions) {
      positions.forEach((p, i) => { if (nodes[i]) { nodes[i].x = p[0]; nodes[i].y = p[1]; } });
      this.sim.stop();
      this.sim.nodes(nodes);
      if (this.opts.fit) this.fit(true);
      this.redraw();
      return this;
    }
    this.sim.nodes(nodes);
    this.sim.force("link").links(this.links);
    if (n > 600) this.sim.force("charge").theta(1.2);
    this.sim.alpha(alpha).restart();
    if (!keep) this.userZoomed = false;
    return this;
  }

  /** Move nodes to given positions (animated layouts); positions in world units. */
  setPositions(positions, { fit = true } = {}) {
    positions.forEach((p, i) => { if (this.nodes[i]) { this.nodes[i].x = p[0]; this.nodes[i].y = p[1]; } });
    if (fit) this.fit(true);
    this.redraw();
  }

  reheat(alpha = 0.3) { if (!this.fixed) this.sim.alpha(alpha).restart(); }

  relayout() {
    if (this.fixed) return;
    const R = 30 * Math.sqrt(this.n);
    for (const d of this.nodes) { d.x = (Math.random() - 0.5) * R; d.y = (Math.random() - 0.5) * R; d.fx = d.fy = null; }
    this.userZoomed = false;
    this.sim.alpha(1).restart();
  }

  stop() { this.sim.stop(); }

  fit(immediate = false) {
    if (!this.nodes.length) return;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const d of this.nodes) {
      if (d.x < x0) x0 = d.x; if (d.x > x1) x1 = d.x;
      if (d.y < y0) y0 = d.y; if (d.y > y1) y1 = d.y;
    }
    const pad = 22 + (this.opts.fitPad || 0);
    const bw = Math.max(1e-6, x1 - x0), bh = Math.max(1e-6, y1 - y0);
    let k = Math.min((this.W - 2 * pad) / bw, (this.H - 2 * pad) / bh);
    k = Math.min(k, this.opts.maxScale || 3);
    const tx = this.W / 2 - k * (x0 + x1) / 2, ty = this.H / 2 - k * (y0 + y1) / 2;
    const t = this.transform;
    const a = immediate ? 1 : 0.25;
    t.k += (k - t.k) * a; t.x += (tx - t.x) * a; t.y += (ty - t.y) * a;
    if (this._zoomBehavior) this._syncZoom();
  }

  _syncZoom() {
    const D3 = d3();
    this._syncing = true;
    D3.select(this.canvas).call(this._zoomBehavior.transform, D3.zoomIdentity.translate(this.transform.x, this.transform.y).scale(this.transform.k));
    this._syncing = false;
  }

  /** Screen coordinates of node i. */
  toScreen(i) {
    const d = this.nodes[i], t = this.transform;
    return [t.x + t.k * d.x, t.y + t.k * d.y];
  }
  toWorld(sx, sy) {
    const t = this.transform;
    return [(sx - t.x) / t.k, (sy - t.y) / t.k];
  }
  radius(i) {
    return this.opts.nodeRadius(i) * (this.opts.scaleNodes ? Math.max(0.6, Math.min(1.8, Math.sqrt(this.transform.k))) : 1);
  }

  findNode(sx, sy, slack = 6) {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < this.n; i++) {
      const [x, y] = this.toScreen(i);
      const d = Math.hypot(x - sx, y - sy);
      if (d < this.radius(i) + slack && d < bestD) { best = i; bestD = d; }
    }
    return best;
  }

  /** Index of the link closest to a screen point (within `slack` px), or −1. */
  findEdge(sx, sy, slack = 6) {
    let best = -1, bestD = slack;
    const E = this.edgeList || [];
    for (let e = 0; e < E.length; e++) {
      const [ax, ay] = this.toScreen(E[e][0]), [bx, by] = this.toScreen(E[e][1]);
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((sx - ax) * dx + (sy - ay) * dy) / L2));
      const d = Math.hypot(sx - ax - t * dx, sy - ay - t * dy);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  _bindEvents() {
    const D3 = d3();
    const canvas = this.canvas;
    const pos = (ev) => { const r = canvas.getBoundingClientRect(); const p = ev.sourceEvent || ev; return [p.clientX - r.left, p.clientY - r.top]; };
    let dragged = false;
    if (this.opts.drag) {
      const drag = D3.drag().container(canvas)
        .subject((ev) => { const [sx, sy] = pos(ev); const i = this.findNode(sx, sy); return i >= 0 ? this.nodes[i] : null; })
        .on("start", (ev) => { dragged = false; if (!this.fixed && !ev.active) this.sim.alphaTarget(0.25).restart(); ev.subject.fx = ev.subject.x; ev.subject.fy = ev.subject.y; })
        .on("drag", (ev) => {
          dragged = true;
          const [sx, sy] = pos(ev);
          const [wx, wy] = this.toWorld(sx, sy);
          ev.subject.fx = wx; ev.subject.fy = wy;
          if (this.fixed) { ev.subject.x = wx; ev.subject.y = wy; this.redraw(); }
          this.userZoomed = true;
        })
        .on("end", (ev) => { if (!this.fixed && !ev.active) this.sim.alphaTarget(0); if (!this.opts.pinOnDrag) { ev.subject.fx = null; ev.subject.fy = null; } });
      D3.select(canvas).call(drag);
    }
    if (this.opts.zoom) {
      this._zoomBehavior = D3.zoom().scaleExtent([0.05, 20])
        .filter((ev) => {
          if (ev.type === "wheel") return ev.ctrlKey || ev.metaKey || this._wheelOK;
          const [sx, sy] = pos(ev);
          return !ev.button && this.findNode(sx, sy) < 0;
        })
        .on("zoom", (ev) => {
          if (this._syncing) return;
          this.transform = { k: ev.transform.k, x: ev.transform.x, y: ev.transform.y };
          this.userZoomed = true;
          this.redraw();
        });
      D3.select(canvas).call(this._zoomBehavior).on("dblclick.zoom", null);
      // wheel zoom only after the user clicks into the view, so page scrolling is never hijacked
      canvas.addEventListener("pointerdown", () => { this._wheelOK = true; });
      this.root.addEventListener("pointerleave", () => { this._wheelOK = false; });
    }
    canvas.addEventListener("pointermove", (ev) => {
      const [sx, sy] = pos(ev);
      const i = this.findNode(sx, sy);
      const overEdge = i < 0 && this.opts.onEdgeClick && this.findEdge(sx, sy) >= 0;
      canvas.style.cursor = i >= 0 || overEdge ? "pointer" : this.opts.onBackgroundClick ? "crosshair" : "grab";
      if (i !== this.hover) {
        this.hover = i;
        this.opts.onHover && this.opts.onHover(i >= 0 ? i : null);
        this.redraw();
      }
      if (i >= 0 && this.opts.tooltip) {
        const c = this.opts.tooltip(i);
        if (c) this.tip.show(ev.clientX, ev.clientY, c); else this.tip.hide();
      } else this.tip.hide();
    });
    canvas.addEventListener("pointerleave", () => {
      if (this.hover !== -1) { this.hover = -1; this.opts.onHover && this.opts.onHover(null); this.redraw(); }
      this.tip.hide();
    });
    canvas.addEventListener("click", (ev) => {
      if (dragged) { dragged = false; return; }
      const [sx, sy] = pos(ev);
      const i = this.findNode(sx, sy);
      if (i >= 0) { this.opts.onClick && this.opts.onClick(i, ev); return; }
      if (this.opts.onEdgeClick) {
        const e = this.findEdge(sx, sy);
        if (e >= 0) { this.opts.onEdgeClick(e, this.edgeList[e], ev); return; }
      }
      if (this.opts.onBackgroundClick) { const [wx, wy] = this.toWorld(sx, sy); this.opts.onBackgroundClick({ x: wx, y: wy }, ev); }
    });
  }

  redraw() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; this._draw(); });
  }

  _draw() {
    const { ctx, W, H, dpr, opts } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const n = this.n;
    const sx = new Float32Array(n), sy = new Float32Array(n);
    for (let i = 0; i < n; i++) { const [x, y] = this.toScreen(i); sx[i] = x; sy[i] = y; }
    const api = { sx, sy, k: this.transform.k, W, H, radius: (i) => this.radius(i), color };

    // edges, batched by style
    const groups = new Map();
    const E = this.edgeList || [];
    for (let e = 0; e < E.length; e++) {
      const [u, v] = E[e];
      const c = opts.edgeColor(u, v, e);
      if (!c) continue;
      const w = opts.edgeWidth(u, v, e);
      const key = c + "|" + w;
      let gr = groups.get(key);
      if (!gr) { gr = { c, w, segs: [] }; groups.set(key, gr); }
      gr.segs.push(u, v);
    }
    ctx.lineCap = "round";
    const sorted = [...groups.values()].sort((a, b) => a.w - b.w);
    for (const gr of sorted) {
      ctx.strokeStyle = color(gr.c);
      ctx.lineWidth = gr.w;
      ctx.globalAlpha = typeof opts.edgeOpacity === "function" ? opts.edgeOpacity(gr.c) : opts.edgeOpacity;
      ctx.beginPath();
      for (let j = 0; j < gr.segs.length; j += 2) {
        const u = gr.segs[j], v = gr.segs[j + 1];
        if (opts.directed) {
          const dx = sx[v] - sx[u], dy = sy[v] - sy[u], L = Math.hypot(dx, dy) || 1;
          const r = this.radius(v) + 2;
          const ex = sx[v] - (dx / L) * r, ey = sy[v] - (dy / L) * r;
          ctx.moveTo(sx[u], sy[u]); ctx.lineTo(ex, ey);
          const ah = 6 + gr.w, aw = 3.5 + gr.w * 0.6;
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - (dx / L) * ah + (dy / L) * aw, ey - (dy / L) * ah - (dx / L) * aw);
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - (dx / L) * ah - (dy / L) * aw, ey - (dy / L) * ah + (dx / L) * aw);
        } else {
          ctx.moveTo(sx[u], sy[u]);
          ctx.lineTo(sx[v], sy[v]);
        }
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (opts.beforeNodes) opts.beforeNodes(ctx, api);

    // nodes: draw in order of opts.nodeOrder (e.g. highlighted last)
    const order = opts.nodeOrder ? opts.nodeOrder() : null;
    const surface = color("surface");
    const idx = order || Array.from({ length: n }, (_, i) => i);
    ctx.lineWidth = opts.ringWidth ?? 1.5;
    for (const i of idx) {
      const r = this.radius(i);
      if (r <= 0) continue;
      const c = opts.nodeColor(i);
      if (!c) continue;
      const op = opts.nodeOpacity ? opts.nodeOpacity(i) : 1;
      ctx.globalAlpha = op;
      ctx.beginPath();
      ctx.arc(sx[i], sy[i], r, 0, 2 * Math.PI);
      ctx.fillStyle = color(c);
      ctx.fill();
      const ring = opts.nodeRing ? opts.nodeRing(i) : null;
      ctx.strokeStyle = ring ? color(ring) : surface;
      ctx.lineWidth = ring ? (opts.ringWidth2 ?? 2.5) : (opts.ringWidth ?? 1.5);
      if (r > 2.2 || ring) ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (this.hover >= 0 && this.hover < n) {
      ctx.beginPath();
      ctx.arc(sx[this.hover], sy[this.hover], this.radius(this.hover) + 3, 0, 2 * Math.PI);
      ctx.strokeStyle = color("text");
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // labels
    if (opts.label) {
      ctx.font = `600 ${opts.labelSize || 11}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < n; i++) {
        const t = opts.label(i);
        if (t == null || t === "") continue;
        const inside = opts.labelInside ? opts.labelInside(i) : this.radius(i) >= 8;
        const x = sx[i], y = inside ? sy[i] + 0.5 : sy[i] - this.radius(i) - 8;
        if (inside) {
          ctx.fillStyle = opts.labelColor ? color(opts.labelColor(i)) : "#ffffff";
          ctx.fillText(t, x, y);
        } else {
          ctx.lineWidth = 3;
          ctx.strokeStyle = surface;
          ctx.strokeText(t, x, y);
          ctx.fillStyle = color("text-2");
          ctx.fillText(t, x, y);
        }
      }
    }
    if (opts.afterNodes) opts.afterNodes(ctx, api);
  }
}

/** Layout helpers in world units (NetView fits them to the canvas). */
export const layouts = {
  circle: (n, r = 200) => Array.from({ length: n }, (_, i) => [r * Math.cos((2 * Math.PI * i) / n - Math.PI / 2), r * Math.sin((2 * Math.PI * i) / n - Math.PI / 2)]),
  grid: (n, cols, gap = 40) => Array.from({ length: n }, (_, i) => [(i % cols) * gap, Math.floor(i / cols) * gap]),
  bipartite: (nTop, nBottom, w = 600, gap = 260) => [
    ...Array.from({ length: nTop }, (_, i) => [nTop > 1 ? (i * w) / (nTop - 1) : w / 2, 0]),
    ...Array.from({ length: nBottom }, (_, i) => [nBottom > 1 ? (i * w) / (nBottom - 1) : w / 2, gap]),
  ],
};
