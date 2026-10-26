// Adjacency-matrix view on a canvas: cell colours from an accessor, hover/click callbacks.
import { h, color, onThemeChange } from "./ui.js";

export class MatrixView {
  /** opts: {rows, cols, cell(i, j) → token|null, onHover(i, j | null), onClick(i, j), maxSize, labels, separators: {rows:[], cols:[]}} */
  constructor(parent, opts) {
    this.opts = { maxSize: 420, labels: false, ...opts };
    this.root = h("div", { class: "matrixview" });
    this.canvas = h("canvas", { role: "img", "aria-label": opts.ariaLabel || "Adjacency matrix" });
    this.root.append(this.canvas);
    (typeof parent === "string" ? document.querySelector(parent) : parent).append(this.root);
    this.ctx = this.canvas.getContext("2d");
    this.hover = null;
    this.ro = new ResizeObserver(() => this.redraw());
    this.ro.observe(this.root);
    onThemeChange(() => this.redraw());
    const at = (ev) => {
      const r = this.canvas.getBoundingClientRect();
      const x = ev.clientX - r.left - this.off, y = ev.clientY - r.top - this.off;
      const j = Math.floor(x / this.cs), i = Math.floor(y / this.cs);
      return i >= 0 && j >= 0 && i < this.opts.rows && j < this.opts.cols ? [i, j] : null;
    };
    this.canvas.addEventListener("pointermove", (ev) => {
      const c = at(ev);
      const key = c ? c.join(",") : null;
      if (key !== (this.hover ? this.hover.join(",") : null)) {
        this.hover = c;
        this.opts.onHover && this.opts.onHover(c ? c[0] : null, c ? c[1] : null, ev);
        this.redraw();
      } else if (c && this.opts.onMove) this.opts.onMove(c[0], c[1], ev);
    });
    this.canvas.addEventListener("pointerleave", () => { this.hover = null; this.opts.onHover && this.opts.onHover(null, null); this.redraw(); });
    this.canvas.addEventListener("click", (ev) => { const c = at(ev); if (c && this.opts.onClick) this.opts.onClick(c[0], c[1]); });
  }

  set(opts) { Object.assign(this.opts, opts); this.redraw(); }

  redraw() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; this._draw(); });
  }

  _draw() {
    const { rows, cols, cell, labels, separators, highlightRows, highlightCols } = this.opts;
    const avail = Math.min(this.root.clientWidth || this.opts.maxSize, this.opts.maxSize);
    const off = labels ? 22 : 0;
    const cs = Math.max(1, Math.floor((avail - off) / Math.max(rows, cols)));
    const W = off + cs * cols, H = off + cs * rows;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = W * dpr; this.canvas.height = H * dpr;
    this.canvas.style.width = W + "px"; this.canvas.style.height = H + "px";
    this.cs = cs; this.off = off;
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = color("surface");
    ctx.fillRect(off, off, cs * cols, cs * rows);
    const gap = cs >= 6 ? 1 : 0;
    // highlighted rows/columns as a wash
    ctx.fillStyle = color("accent-wash");
    for (const i of highlightRows || []) ctx.fillRect(off, off + i * cs, cs * cols, cs);
    for (const j of highlightCols || []) ctx.fillRect(off + j * cs, off, cs, cs * rows);
    if (this.hover) {
      ctx.fillStyle = color("surface-3");
      ctx.fillRect(off, off + this.hover[0] * cs, cs * cols, cs);
      ctx.fillRect(off + this.hover[1] * cs, off, cs, cs * rows);
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const c = cell(i, j);
      if (!c) continue;
      ctx.fillStyle = color(c);
      ctx.fillRect(off + j * cs + gap / 2, off + i * cs + gap / 2, cs - gap, cs - gap);
    }
    if (cs >= 8 && this.opts.gridLines !== false) {
      ctx.strokeStyle = color("grid");
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let i = 0; i <= rows; i++) { ctx.moveTo(off, off + i * cs); ctx.lineTo(off + cols * cs, off + i * cs); }
      for (let j = 0; j <= cols; j++) { ctx.moveTo(off + j * cs, off); ctx.lineTo(off + j * cs, off + rows * cs); }
      ctx.stroke();
    }
    if (separators) {
      ctx.strokeStyle = color("text-2");
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const r of separators.rows || []) { ctx.moveTo(off, off + r * cs); ctx.lineTo(off + cols * cs, off + r * cs); }
      for (const c of separators.cols || []) { ctx.moveTo(off + c * cs, off); ctx.lineTo(off + c * cs, off + rows * cs); }
      ctx.stroke();
    }
    if (this.hover) {
      ctx.strokeStyle = color("text");
      ctx.lineWidth = 1.5;
      ctx.strokeRect(off + this.hover[1] * cs + 0.5, off + this.hover[0] * cs + 0.5, cs - 1, cs - 1);
    }
    if (labels) {
      ctx.fillStyle = color("muted");
      ctx.font = `${Math.min(10, cs - 1)}px system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const every = cs >= 10 ? 1 : Math.ceil(10 / cs);
      const rl = this.opts.rowLabel || ((i) => i), cl = this.opts.colLabel || ((j) => j);
      for (let j = 0; j < cols; j += every) ctx.fillText(cl(j), off + j * cs + cs / 2, off / 2);
      ctx.textAlign = "right";
      for (let i = 0; i < rows; i += every) ctx.fillText(rl(i), off - 4, off + i * cs + cs / 2);
    }
  }
}
