// Run a task from tasks.js in a Web Worker (one worker per run, so a run can be cancelled).
// Falls back to the main thread, in small slices, where module workers are unavailable.
import { TASKS } from "./tasks.js";

let workerOK = null;
function supportsModuleWorker() {
  if (workerOK !== null) return workerOK;
  try {
    let ok = false;
    const opts = { get type() { ok = true; return "module"; } };
    new Worker("data:text/javascript,", opts).terminate();
    workerOK = ok;
  } catch { workerOK = false; }
  return workerOK;
}

/**
 * run("distanceVsN", params, onProgress) → {promise, cancel}
 * onProgress receives every value the task yields; the promise resolves with its return value.
 */
export function run(task, params, onProgress = () => {}) {
  if (supportsModuleWorker()) {
    const w = new Worker(new URL("../workers/compute.js", import.meta.url), { type: "module" });
    let settle;
    const promise = new Promise((resolve, reject) => {
      settle = { resolve, reject };
      w.onmessage = (ev) => {
        const { type, value } = ev.data;
        if (type === "progress") onProgress(value);
        else if (type === "done") { w.terminate(); resolve(value); }
        else { w.terminate(); reject(new Error(value)); }
      };
      w.onerror = (e) => { w.terminate(); reject(new Error(e.message || "worker failed")); };
    });
    w.postMessage({ task, params });
    return { promise, cancel: () => { w.terminate(); settle.reject(new Error("cancelled")); } };
  }
  // main-thread fallback: advance the generator between animation frames
  let cancelled = false;
  const promise = new Promise((resolve, reject) => {
    const it = TASKS[task](params);
    const pump = () => {
      if (cancelled) { reject(new Error("cancelled")); return; }
      const t0 = performance.now();
      try {
        while (performance.now() - t0 < 30) {
          const s = it.next();
          if (s.done) { resolve(s.value); return; }
          onProgress(s.value);
        }
      } catch (e) { reject(e); return; }
      setTimeout(pump, 0);
    };
    pump();
  });
  return { promise, cancel: () => { cancelled = true; } };
}
