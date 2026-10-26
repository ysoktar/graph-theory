// Module worker: runs one task from lib/tasks.js and streams its progress back.
import { TASKS } from "../lib/tasks.js";

self.onmessage = (ev) => {
  const { task, params } = ev.data;
  try {
    const it = TASKS[task](params);
    let step = it.next();
    while (!step.done) {
      self.postMessage({ type: "progress", value: step.value });
      step = it.next();
    }
    self.postMessage({ type: "done", value: step.value });
  } catch (err) {
    self.postMessage({ type: "error", value: String(err && err.stack || err) });
  }
};
