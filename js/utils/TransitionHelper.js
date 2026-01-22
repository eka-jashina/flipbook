/**
 * TRANSITION HELPER
 * Утилита для ожидания CSS transitions.
 */

export class TransitionHelper {
  /**
   * Ожидать завершения CSS transition
   */
  static waitFor(element, propertyName, timeout, signal = null) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }

      let resolved = false;
      let timeoutId = null;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        element.removeEventListener("transitionend", handler);
        signal?.removeEventListener("abort", onAbort);
      };

      const done = () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve();
      };

      const handler = (e) => {
        if (e.target !== element) return;
        if (propertyName && e.propertyName !== propertyName) return;
        done();
      };

      const onAbort = () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        reject(new DOMException("Aborted", "AbortError"));
      };

      element.addEventListener("transitionend", handler);
      timeoutId = setTimeout(done, timeout);
      signal?.addEventListener("abort", onAbort);
    });
  }
}
