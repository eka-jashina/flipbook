/**
 * TIMER MANAGER
 * Обёртка над setTimeout и requestAnimationFrame.
 */

export class TimerManager {
  constructor() {
    this.timeouts = new Set();
    this.animationFrames = new Set();
  }

  setTimeout(callback, delay) {
    const id = setTimeout(() => {
      this.timeouts.delete(id);
      callback();
    }, delay);
    this.timeouts.add(id);
    return id;
  }

  clearTimeout(id) {
    clearTimeout(id);
    this.timeouts.delete(id);
  }

  requestAnimationFrame(callback) {
    const id = requestAnimationFrame((timestamp) => {
      this.animationFrames.delete(id);
      callback(timestamp);
    });
    this.animationFrames.add(id);
    return id;
  }

  cancelAnimationFrame(id) {
    cancelAnimationFrame(id);
    this.animationFrames.delete(id);
  }

  clear() {
    for (const id of this.timeouts) clearTimeout(id);
    this.timeouts.clear();
    for (const id of this.animationFrames) cancelAnimationFrame(id);
    this.animationFrames.clear();
  }
}
