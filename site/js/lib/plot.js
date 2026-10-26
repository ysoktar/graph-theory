// A small SVG charting layer on top of d3 (global). Conventions follow the notebook:
// real data = series colour 1, random networks = "random" grey, theory = dashed "theory" line.
//
//   const p = new Plot(el, {height: 280, x: {type: "log", label: "k"}, y: {type: "log", label: "pₖ"}});
//   p.update({series: [{id, type: "scatter"|"line"|"bar"|"area"|"range"|"step", data: [[x, y], …],
//                       color: 1..8 | "random" | "theory", label, dashed, thin, r}],
//             rules: [{x | y, label, dashed}], bands: [{x0, x1, label}], annotations: [{x, y, text}]});
import { h, tooltip, ttRow } from "./ui.js";
import { fmt, superscript, arrMax, arrMin } from "./stats.js";

const d3 = () => window.d3;
let plotId = 0;
const cssColor = (c) => (typeof c === "number" ? `var(--s${c})` : c == null ? "var(--s1)" : c.startsWith("#") ? c : `var(--${c})`);
const colorCls = (c) => (typeof c === "number" ? "c" + c : c == null ? "c1" : "c-" + c);

export function formatTick(v, type) {
  if (v === 0) return "0";
  if (type === "log") {
    const e = Math.round(Math.log10(v));
    if (Math.abs(v - Math.pow(10, e)) < 1e-9 * v) {
      if (e >= 0 && e <= 3) return String(Math.pow(10, e));
      return "10" + superscript(e);
    }
    return v >= 1 ? fmt.sig(v, 2) : String(+v.toPrecision(2));
  }
  const a = Math.abs(v);
  if (a >= 1e6) return +(v / 1e6).toPrecision(3) + "M";
  if (a >= 1e4) return +(v / 1e3).toPrecision(3) + "K";
  if (a >= 1000) return v.toLocaleString("en-US");
  return String(+v.toPrecision(6));
}

export class Plot {
  constructor(parent, opts = {}) {
    this.id = ++plotId;
    this.opts = {
      height: 260, margin: { top: 12, right: 18, bottom: 42, left: 56 }, legend: true, table: true,
      ...opts, x: { type: "linear", ...(opts.x || {}) }, y: { type: "linear", ...(opts.y || {}) },
    };
    this.root = h("div", { class: "plot" });
    this.legendEl = h("div", { class: "legend" });
    if (this.opts.legend) this.root.append(this.legendEl);
    this.svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svgEl.setAttribute("role", "img");
    this.svgEl.setAttribute("class", "chart");
    if (this.opts.ariaLabel) this.svgEl.setAttribute("aria-label", this.opts.ariaLabel);
    this.root.append(this.svgEl);
    if (this.opts.table) {
      this.tableEl = h("details", { class: "plot-table" }, h("summary", {}, "Data table"));
      this.tableEl.addEventListener("toggle", () => this.tableEl.open && this.renderTable());
      this.root.append(this.tableEl);
    }
    (typeof parent === "string" ? document.querySelector(parent) : parent).append(this.root);
    this.spec = { series: [] };
    this.tip = tooltip();
    this.width = 0;
    this.ro = new ResizeObserver(() => {
      const w = this.root.clientWidth;
      if (w && Math.abs(w - this.width) > 1) { this.width = w; this.render(); }
    });
    this.ro.observe(this.root);
  }

  update(spec) {
    this.spec = { ...spec, series: (spec.series || []).filter(Boolean) };
    if (spec.x) this.opts.x = { ...this.opts.x, ...spec.x };
    if (spec.y) this.opts.y = { ...this.opts.y, ...spec.y };
    this.render();
    if (this.tableEl && this.tableEl.open) this.renderTable();
    return this;
  }

  /** Change axis settings (e.g. linear ↔ log) and redraw. */
  axes({ x, y } = {}) {
    if (x) this.opts.x = { ...this.opts.x, ...x };
    if (y) this.opts.y = { ...this.opts.y, ...y };
    this.render();
  }

  _domain(axis, key) {
    const o = this.opts[axis];
    if (o.domain) return o.domain;
    const vals = [];
    const idx = key === "x" ? 0 : 1;
    for (const s of this.spec.series) {
      if (s.excludeFromDomain) continue;
      for (const d of s.data || []) {
        const v = d[idx];
        if (v == null || !Number.isFinite(v)) continue;
        if (o.type === "log" && v <= 0) continue;
        vals.push(v);
        if (s.type === "range" && idx === 1 && Number.isFinite(d[2])) vals.push(d[2]);
      }
      if ((s.type === "bar" || s.type === "area") && idx === 1 && o.type !== "log") vals.push(0);
    }
    for (const r of this.spec.rules || []) if (r[key] != null && !r.excludeFromDomain) vals.push(r[key]);
    if (o.include) vals.push(...o.include);
    if (!vals.length) return o.type === "log" ? [1, 10] : [0, 1];
    let lo = arrMin(vals), hi = arrMax(vals);
    if (o.min != null) lo = o.min;
    if (o.max != null) hi = o.max;
    if (o.type === "log") {
      if (o.min == null) lo = Math.pow(10, Math.floor(Math.log10(lo) + 1e-9));
      if (o.max == null) hi = Math.pow(10, Math.ceil(Math.log10(hi) - 1e-9));
      if (hi <= lo) hi = lo * 10;
      return [lo, hi];
    }
    if (o.zero !== false && lo > 0 && o.min == null && (key === "y" || o.zero)) lo = 0;
    if (key === "x") {
      // bars centred on their x need half a bar of room at both ends
      const bars = this.spec.series.filter((s) => s.type === "bar" && s.data && s.data.length);
      if (bars.length) {
        let step = Infinity;
        for (const s of bars) { const xs = s.data.map((d) => d[0]).sort((a, b) => a - b); for (let i = 1; i < xs.length; i++) if (xs[i] > xs[i - 1]) step = Math.min(step, xs[i] - xs[i - 1]); }
        if (!Number.isFinite(step)) step = 1;
        if (o.min == null) lo -= step / 2;
        if (o.max == null) hi += step / 2;
      }
    }
    if (lo === hi) { lo -= 1; hi += 1; }
    return [lo, hi];
  }

  _scale(axis, domain, range) {
    const o = this.opts[axis];
    const s = o.type === "log" ? d3().scaleLog().domain(domain).range(range) : d3().scaleLinear().domain(domain).range(range);
    if (o.type !== "log" && o.nice !== false && !o.domain && o.min == null && o.max == null) s.nice(o.ticks || 6);
    return s;
  }

  _ticks(scale, axis) {
    const o = this.opts[axis];
    if (o.tickValues) return { major: o.tickValues, minor: [] };
    if (o.type !== "log") {
      let t = scale.ticks(o.ticks || (axis === "x" ? Math.max(3, Math.floor(this.width / 90)) : 5));
      if (o.integer) t = t.filter((v) => Number.isInteger(v));
      return { major: t, minor: [] };
    }
    const [a, b] = scale.domain();
    const e0 = Math.floor(Math.log10(a) + 1e-9), e1 = Math.ceil(Math.log10(b) - 1e-9);
    const major = [], minor = [];
    const span = e1 - e0;
    const every = span > 12 ? 3 : span > 7 ? 2 : 1;
    for (let e = e0; e <= e1; e++) {
      const v = Math.pow(10, e);
      if (v >= a * 0.9999 && v <= b * 1.0001 && (e - e0) % every === 0) major.push(v);
      if (span <= 7) for (let m = 2; m <= 9; m++) { const w = m * v; if (w > a && w < b) minor.push(w); }
    }
    if (span < 1.5) for (const w of minor.filter((w) => /^[25]/.test(String(w / Math.pow(10, Math.floor(Math.log10(w))))))) major.push(w);
    return { major: major.sort((p, q) => p - q), minor };
  }

  render() {
    const D3 = d3();
    if (!D3) return;
    const W = this.root.clientWidth || 600;
    this.width = W;
    const { margin } = this.opts;
    const H = typeof this.opts.height === "function" ? this.opts.height(W) : this.opts.height;
    const iw = Math.max(10, W - margin.left - margin.right), ih = Math.max(10, H - margin.top - margin.bottom);
    const svg = D3.select(this.svgEl).attr("viewBox", `0 0 ${W} ${H}`).attr("height", H);
    svg.selectAll("*").remove();
    const xd = this._domain("x", "x"), yd = this._domain("y", "y");
    const x = this._scale("x", xd, [0, iw]), y = this._scale("y", yd, [ih, 0]);
    this.x = x; this.y = y; this.iw = iw; this.ih = ih;
    const clipId = `clip-${this.id}`;
    svg.append("defs").append("clipPath").attr("id", clipId).append("rect").attr("x", -6).attr("y", -6).attr("width", iw + 12).attr("height", ih + 12);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // bands (regimes etc.)
    for (const b of this.spec.bands || []) {
      const x0 = Math.max(0, x(Math.max(b.x0, x.domain()[0]))), x1 = Math.min(iw, x(Math.min(b.x1, x.domain()[1])));
      if (x1 <= x0) continue;
      g.append("rect").attr("class", "band").attr("x", x0).attr("y", 0).attr("width", x1 - x0).attr("height", ih).style("opacity", b.opacity ?? null);
      if (b.label) g.append("text").attr("class", "annot").attr("x", (x0 + x1) / 2).attr("y", 12).attr("text-anchor", "middle").text(b.label);
    }

    // grid
    const xt = this._ticks(x, "x"), yt = this._ticks(y, "y");
    const grid = g.append("g").attr("class", "grid");
    if (this.opts.y.grid !== false) {
      for (const v of yt.minor) grid.append("line").attr("class", "minor").attr("x1", 0).attr("x2", iw).attr("y1", y(v)).attr("y2", y(v));
      for (const v of yt.major) grid.append("line").attr("x1", 0).attr("x2", iw).attr("y1", y(v)).attr("y2", y(v));
    }
    if (this.opts.x.grid) for (const v of xt.major) grid.append("line").attr("y1", 0).attr("y2", ih).attr("x1", x(v)).attr("x2", x(v));

    // axes
    const fx = this.opts.x.format || ((v) => formatTick(v, this.opts.x.type));
    const fy = this.opts.y.format || ((v) => formatTick(v, this.opts.y.type));
    const ax = g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
      .call(D3.axisBottom(x).tickValues(xt.major).tickFormat(fx).tickSizeOuter(0).tickSize(4));
    ax.selectAll(".tick").filter((v) => xt.minor.includes(v)).remove();
    const ay = g.append("g").attr("class", "axis").call(D3.axisLeft(y).tickValues(yt.major).tickFormat(fy).tickSizeOuter(0).tickSize(0).tickPadding(6));
    ay.select(".domain").remove();
    if (this.opts.x.label) g.append("text").attr("class", "axis-label").attr("x", iw / 2).attr("y", ih + 34).attr("text-anchor", "middle").text(this.opts.x.label);
    if (this.opts.y.label) g.append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("x", -ih / 2).attr("y", -margin.left + 14).attr("text-anchor", "middle").text(this.opts.y.label);

    const plotArea = g.append("g").attr("clip-path", `url(#${clipId})`);
    const valid = (d) => d[0] != null && d[1] != null && Number.isFinite(d[0]) && Number.isFinite(d[1]) &&
      (this.opts.x.type !== "log" || d[0] > 0) && (this.opts.y.type !== "log" || d[1] > 0);

    // bars need a width: the smallest x-spacing of the series
    for (const s of this.spec.series) {
      const data = (s.data || []).filter(valid);
      const col = cssColor(s.color);
      if (s.type === "bar") {
        const xs = data.map((d) => x(d[0])).sort((a, b) => a - b);
        let step = iw / 6;
        for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > 0.5) step = Math.min(step, xs[i] - xs[i - 1]);
        const bw = Math.max(1, Math.min(s.maxWidth ?? 24, step - (step > 6 ? 2 : 0.5)));
        const base = this.opts.y.type === "log" ? ih : y(0);
        const rad = Math.min(4, bw / 2);
        const gg = plotArea.append("g");
        for (const d of data) {
          const cx = x(d[0]) + (s.offset || 0) * bw, top = y(d[1]);
          const hgt = Math.max(0, base - top);
          if (hgt <= 0) continue;
          gg.append("path").attr("class", "series-bar").attr("fill", d[2]?.color ? cssColor(d[2].color) : col)
            .attr("opacity", s.opacity ?? null)
            .attr("d", roundedTop(cx - bw / 2, top, bw, hgt, Math.min(rad, hgt)));
        }
      } else if (s.type === "line" || s.type === "step") {
        const line = D3.line().x((d) => x(d[0])).y((d) => y(d[1])).defined(valid);
        if (s.type === "step") line.curve(D3.curveStepAfter);
        if (s.curve === "monotone") line.curve(D3.curveMonotoneX);
        plotArea.append("path").datum(s.data || []).attr("class", "series-line" + (s.dashed ? " dashed" : "") + (s.thin ? " thin" : ""))
          .attr("d", line).style("stroke", col).style("opacity", s.opacity ?? null).style("stroke-width", s.width ?? null);
        if (s.markers) plotArea.append("g").selectAll("circle").data(data).join("circle").attr("class", "series-dot")
          .attr("cx", (d) => x(d[0])).attr("cy", (d) => y(d[1])).attr("r", s.r || 3.5).style("fill", col);
      } else if (s.type === "area") {
        const base = this.opts.y.type === "log" ? y.domain()[0] : 0;
        const area = D3.area().x((d) => x(d[0])).y0(y(base)).y1((d) => y(d[1])).defined(valid);
        plotArea.append("path").datum(s.data || []).attr("class", "series-area").attr("d", area).style("fill", col);
        plotArea.append("path").datum(s.data || []).attr("class", "series-line").attr("d", D3.line().x((d) => x(d[0])).y((d) => y(d[1])).defined(valid)).style("stroke", col);
      } else if (s.type === "range") {
        const area = D3.area().x((d) => x(d[0])).y0((d) => y(d[1])).y1((d) => y(d[2])).defined((d) => valid(d) && Number.isFinite(d[2]) && (this.opts.y.type !== "log" || d[2] > 0));
        plotArea.append("path").datum(s.data || []).attr("class", "series-area").attr("d", area).style("fill", col).style("opacity", s.opacity ?? 0.14);
      } else {
        // scatter
        const r = s.r || 4;
        const sel = plotArea.append("g").selectAll("path").data(data).join("path").attr("class", "series-dot")
          .attr("transform", (d) => `translate(${x(d[0])},${y(d[1])})`)
          .attr("d", D3.symbol(s.symbol === "square" ? D3.symbolSquare : s.symbol === "triangle" ? D3.symbolTriangle : s.symbol === "diamond" ? D3.symbolDiamond : D3.symbolCircle, Math.PI * r * r * (s.symbol === "square" ? 0.8 : 1)))
          .style("fill", col).style("opacity", s.opacity ?? null);
        if (s.hollow) sel.style("fill", "var(--surface)").style("stroke", col).style("stroke-width", 1.5);
      }
    }

    // rules and annotations (on top)
    for (const r of this.spec.rules || []) {
      if (r.x != null) {
        const px = x(r.x);
        if (!(px >= -0.5 && px <= iw + 0.5)) continue;
        g.append("line").attr("class", "rule" + (r.dashed ? " dashed" : "")).attr("x1", px).attr("x2", px).attr("y1", 0).attr("y2", ih).style("stroke", r.color ? cssColor(r.color) : null);
        if (r.label) g.append("text").attr("class", "rule-label").attr("x", px + (r.align === "left" ? -4 : 4)).attr("y", r.labelY ?? 11).attr("text-anchor", r.align === "left" ? "end" : "start").text(r.label);
      } else if (r.y != null) {
        const py = y(r.y);
        if (!(py >= -0.5 && py <= ih + 0.5)) continue;
        g.append("line").attr("class", "rule" + (r.dashed ? " dashed" : "")).attr("x1", 0).attr("x2", iw).attr("y1", py).attr("y2", py).style("stroke", r.color ? cssColor(r.color) : null);
        if (r.label) g.append("text").attr("class", "rule-label").attr("x", r.align === "left" ? 4 : iw - 4).attr("y", py - 5).attr("text-anchor", r.align === "left" ? "start" : "end").text(r.label);
      }
    }
    for (const a of this.spec.annotations || []) {
      if (!valid([a.x, a.y])) continue;
      const t = g.append("text").attr("class", "annot" + (a.strong ? " strong" : "")).attr("x", x(a.x) + (a.dx || 0)).attr("y", y(a.y) + (a.dy || 0))
        .attr("text-anchor", a.anchor || "start").text(a.text);
      if (a.dot) g.append("circle").attr("class", "hover-dot").attr("cx", x(a.x)).attr("cy", y(a.y)).attr("r", 4.5).style("fill", cssColor(a.color ?? "text"));
      t.raise();
    }

    this._legend();
    this._hover(g, iw, ih, valid);
  }

  _legend() {
    if (!this.opts.legend) return;
    const items = this.spec.series.filter((s) => s.label && s.legend !== false);
    this.legendEl.replaceChildren();
    if (items.length < (this.spec.forceLegend ? 1 : 2) && !this.spec.legendAlways) { this.legendEl.style.display = "none"; return; }
    this.legendEl.style.display = "";
    for (const s of items) {
      const col = cssColor(s.color);
      let sw;
      if (s.type === "line" || s.type === "step") sw = `<svg width="18" height="10"><line x1="1" x2="17" y1="5" y2="5" stroke="${col}" stroke-width="2" ${s.dashed ? 'stroke-dasharray="4 3"' : ""} stroke-linecap="round"/></svg>`;
      else if (s.type === "bar" || s.type === "area" || s.type === "range") sw = `<svg width="12" height="12"><rect x="1" y="1" width="10" height="10" rx="2.5" fill="${col}" ${s.type === "range" ? 'opacity=".35"' : ""}/></svg>`;
      else if (s.symbol === "square") sw = `<svg width="12" height="12"><rect x="2" y="2" width="8" height="8" fill="${col}"/></svg>`;
      else if (s.symbol === "triangle") sw = `<svg width="12" height="12"><path d="M6 1.5L11 10H1z" fill="${col}"/></svg>`;
      else if (s.symbol === "diamond") sw = `<svg width="12" height="12"><path d="M6 1L11 6L6 11L1 6z" fill="${col}"/></svg>`;
      else sw = `<svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="${s.hollow ? "none" : col}" stroke="${col}" stroke-width="${s.hollow ? 1.5 : 0}"/></svg>`;
      const it = h("span", { class: "legend-item" });
      it.innerHTML = sw;
      it.append(document.createTextNode(s.label));
      this.legendEl.append(it);
    }
  }

  _hover(g, iw, ih, valid) {
    const D3 = d3();
    if (this.spec.hover === false) return;
    const series = this.spec.series.filter((s) => s.data && s.data.length && s.tooltip !== false);
    if (!series.length) return;
    const mode = this.spec.hover || (series.some((s) => s.type === "line" || s.type === "area" || s.type === "step") ? "x" : "point");
    const { x, y } = this;
    const fx = this.spec.xFormat || ((v) => fmt.sig(v, 4));
    const fy = this.spec.yFormat || ((v) => fmt.sig(v, 3));
    const xLabel = this.spec.xName || this.opts.x.label || "x";
    const layer = g.append("g").style("pointer-events", "none");
    const overlay = g.append("rect").attr("class", "hit").attr("width", iw).attr("height", ih).style("touch-action", "pan-y");

    if (mode === "x") {
      const cross = layer.append("line").attr("class", "crosshair").attr("y1", 0).attr("y2", ih).style("display", "none");
      const sorted = series.map((s) => ({ s, data: s.data.filter(valid).slice().sort((a, b) => a[0] - b[0]) }));
      const move = (ev) => {
        const [mx] = D3.pointer(ev, overlay.node());
        // nearest data x over all series
        let best = null, bestDx = Infinity;
        for (const { data } of sorted) {
          const i = nearestIndex(data, x.invert(mx));
          if (i < 0) continue;
          const dx = Math.abs(x(data[i][0]) - mx);
          if (dx < bestDx) { bestDx = dx; best = data[i][0]; }
        }
        if (best == null) return;
        const px = x(best);
        cross.attr("x1", px).attr("x2", px).style("display", null);
        layer.selectAll("circle").remove();
        const rows = [];
        for (const { s, data } of sorted) {
          const i = nearestIndex(data, best);
          if (i < 0) continue;
          const d = data[i];
          if (Math.abs(x(d[0]) - px) > 12) continue;
          if (s.type !== "bar") layer.append("circle").attr("class", "hover-dot").attr("cx", x(d[0])).attr("cy", y(d[1])).attr("r", 4.5).style("fill", cssColor(s.color));
          rows.push(ttRow((s.format || fy)(d[1], d), s.label || "", colorCls(s.color)));
        }
        this.tip.show(ev.clientX, ev.clientY, [h("div", { class: "tt-title" }, `${xLabel} = ${fx(best)}`), ...rows]);
      };
      overlay.on("pointermove", move).on("pointerleave", () => { cross.style("display", "none"); layer.selectAll("circle").remove(); this.tip.hide(); });
    } else {
      const pts = [];
      for (const s of series) for (const d of s.data) if (valid(d)) pts.push({ s, d, px: x(d[0]), py: y(d[1]) });
      if (!pts.length) return;
      const del = D3.Delaunay.from(pts, (p) => p.px, (p) => p.py);
      const ring = layer.append("circle").attr("class", "hover-dot").attr("r", 6).style("display", "none").style("fill", "none").style("stroke", "var(--text)").style("stroke-width", 1.5);
      const move = (ev) => {
        const [mx, my] = D3.pointer(ev, overlay.node());
        const p = pts[del.find(mx, my)];
        if (!p || Math.hypot(p.px - mx, p.py - my) > 28) { ring.style("display", "none"); this.tip.hide(); return; }
        ring.attr("cx", p.px).attr("cy", p.py).style("display", null);
        const content = p.s.tooltip ? p.s.tooltip(p.d) : [h("div", { class: "tt-title" }, `${xLabel} = ${fx(p.d[0])}`), ttRow((p.s.format || fy)(p.d[1], p.d), p.s.label || "", colorCls(p.s.color))];
        this.tip.show(ev.clientX, ev.clientY, content);
      };
      overlay.on("pointermove", move).on("pointerleave", () => { ring.style("display", "none"); this.tip.hide(); });
    }
  }

  renderTable() {
    const fx = this.spec.xFormat || ((v) => fmt.sig(v, 5));
    const fy = this.spec.yFormat || ((v) => fmt.sig(v, 4));
    const wrap = h("div", { class: "table-wrap" });
    const table = h("table", { class: "data" });
    table.append(h("thead", {}, h("tr", {}, h("th", { class: "left" }, "series"), h("th", {}, this.spec.xName || this.opts.x.label || "x"), h("th", {}, this.opts.y.label || "y"))));
    const tb = h("tbody");
    for (const s of this.spec.series) {
      if (!s.data || s.table === false) continue;
      const rows = s.data.length > 600 ? s.data.filter((_, i) => i % Math.ceil(s.data.length / 600) === 0) : s.data;
      for (const d of rows) tb.append(h("tr", {}, h("td", { class: "left" }, s.label || s.id || ""), h("td", {}, fx(d[0])), h("td", {}, d[1] == null ? "–" : (s.format || fy)(d[1], d) + (s.type === "range" ? ` – ${fy(d[2])}` : ""))));
    }
    table.append(tb);
    wrap.append(table);
    this.tableEl.querySelector(".table-wrap")?.remove();
    this.tableEl.append(wrap);
  }
}

function nearestIndex(data, xv) {
  if (!data.length) return -1;
  let lo = 0, hi = data.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (data[mid][0] < xv) lo = mid; else hi = mid;
  }
  return Math.abs(data[lo][0] - xv) <= Math.abs(data[hi][0] - xv) ? lo : hi;
}

function roundedTop(x, y, w, hgt, r) {
  r = Math.max(0, Math.min(r, w / 2, hgt));
  return `M${x},${y + hgt}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hgt}Z`;
}

/** Convenience: a line series from a function sampled on [a, b]. */
export function fnSeries(f, a, b, n = 200, { log = false, ...rest } = {}) {
  const data = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const xv = log ? a * Math.pow(b / a, t) : a + (b - a) * t;
    const yv = f(xv);
    data.push([xv, Number.isFinite(yv) ? yv : null]);
  }
  return { type: "line", data, ...rest };
}
