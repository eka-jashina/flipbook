/**
 * Тесты для ContentLoader
 * Загрузка и кэширование HTML-контента с retry-логикой
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContentLoader } from '../../../js/managers/ContentLoader.js';
import { CONFIG } from '../../../js/config.js';

const { MAX_RETRIES, INITIAL_RETRY_DELAY } = CONFIG.NETWORK;

describe('ContentLoader', () => {
  let loader;
  let originalFetch;

  beforeEach(() => {
    vi.useFakeTimers();
    loader = new ContentLoader();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize empty cache', () => {
      expect(loader.cache.size).toBe(0);
    });

    it('should initialize null controller', () => {
      expect(loader.controller).toBeNull();
    });
  });

  describe('_delay', () => {
    it('should resolve after specified time', async () => {
      const promise = loader._delay(1000, null);
      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    });

    it('should reject on abort', async () => {
      const controller = new AbortController();
      const promise = loader._delay(1000, controller.signal);

      controller.abort();

      await expect(promise).rejects.toThrow('Aborted');
    });

    it('should clear timeout on abort', async () => {
      const controller = new AbortController();
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const promise = loader._delay(1000, controller.signal);
      controller.abort();

      try {
        await promise;
      } catch (e) {
        // expected
      }

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('_fetchWithRetry', () => {
    it('should return text on successful response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html>content</html>'),
      });

      const result = await loader._fetchWithRetry('test.html', null);
      expect(result).toBe('<html>content</html>');
    });

    it('should retry and throw on 4xx errors', async () => {
      // Note: implementation retries ALL errors including 4xx (despite comment in source)
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const resultPromise = loader._fetchWithRetry('notfound.html', null);

      // Attach rejection handler before advancing timers to avoid unhandled rejection warning
      const expectPromise = expect(resultPromise)
        .rejects.toThrow('Failed to load notfound.html after 3 attempts');

      // Wait for all retry delays (exponential backoff)
      await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY);
      await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY * 2);

      await expectPromise;

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should retry on 5xx errors', async () => {
      let attempts = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.resolve({ ok: false, status: 500 });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('success'),
        });
      });

      const resultPromise = loader._fetchWithRetry('test.html', null);

      // First attempt fails, wait for retry delay
      await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY);
      // Second attempt fails, wait for retry delay (exponential)
      await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY * 2);

      const result = await resultPromise;
      expect(result).toBe('success');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      const resultPromise = loader._fetchWithRetry('test.html', null);

      // Attach rejection handler before advancing timers
      const expectPromise = expect(resultPromise)
        .rejects.toThrow('Failed to load test.html after 3 attempts');

      // Wait for all retry delays (exponential backoff)
      await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY); // First retry
      await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY * 2); // Second retry

      await expectPromise;
    });

    it('should not retry on AbortError', async () => {
      const abortError = new DOMException('Aborted', 'AbortError');
      global.fetch = vi.fn().mockRejectedValue(abortError);

      await expect(loader._fetchWithRetry('test.html', null))
        .rejects.toThrow('Aborted');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should pass signal to fetch', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('content'),
      });

      const controller = new AbortController();
      await loader._fetchWithRetry('test.html', controller.signal);

      expect(global.fetch).toHaveBeenCalledWith('test.html', { signal: controller.signal });
    });

    it('should retry on network errors', async () => {
      let attempts = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('recovered'),
        });
      });

      const resultPromise = loader._fetchWithRetry('test.html', null);
      await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY);

      const result = await resultPromise;
      expect(result).toBe('recovered');
    });
  });

  describe('load', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockImplementation((url) =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`<content>${url}</content>`),
        })
      );
    });

    it('should load single URL', async () => {
      const result = await loader.load(['page1.html']);
      expect(result).toBe('<content>page1.html</content>');
    });

    it('should load multiple URLs and join', async () => {
      const result = await loader.load(['page1.html', 'page2.html']);
      expect(result).toBe('<content>page1.html</content>\n<content>page2.html</content>');
    });

    it('should cache loaded content', async () => {
      await loader.load(['page1.html']);
      expect(loader.cache.has('page1.html')).toBe(true);
    });

    it('should use cache on subsequent loads', async () => {
      await loader.load(['page1.html']);
      global.fetch.mockClear();

      const result = await loader.load(['page1.html']);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result).toBe('<content>page1.html</content>');
    });

    it('should only fetch missing URLs', async () => {
      loader.cache.set('cached.html', '<cached>content</cached>');

      const result = await loader.load(['cached.html', 'new.html']);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('new.html', expect.any(Object));
      expect(result).toContain('<cached>content</cached>');
      expect(result).toContain('<content>new.html</content>');
    });

    it('should preserve URL order in result', async () => {
      const result = await loader.load(['a.html', 'b.html', 'c.html']);
      const parts = result.split('\n');
      expect(parts[0]).toContain('a.html');
      expect(parts[1]).toContain('b.html');
      expect(parts[2]).toContain('c.html');
    });

    it('should abort previous load', async () => {
      const abortSpy = vi.fn();
      loader.controller = { abort: abortSpy };

      await loader.load(['test.html']);

      expect(abortSpy).toHaveBeenCalled();
    });

    it('should create new AbortController', async () => {
      await loader.load(['test.html']);
      expect(loader.controller).toBeInstanceOf(AbortController);
    });

    it('should load all cached URLs without fetch', async () => {
      loader.cache.set('a.html', 'content-a');
      loader.cache.set('b.html', 'content-b');

      const result = await loader.load(['a.html', 'b.html']);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result).toBe('content-a\ncontent-b');
    });
  });

  describe('abort', () => {
    it('should call abort on controller', () => {
      const abortSpy = vi.fn();
      loader.controller = { abort: abortSpy };

      loader.abort();

      expect(abortSpy).toHaveBeenCalled();
    });

    it('should set controller to null', () => {
      loader.controller = new AbortController();
      loader.abort();
      expect(loader.controller).toBeNull();
    });

    it('should not fail if no controller', () => {
      expect(() => loader.abort()).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear cache', () => {
      loader.cache.set('a.html', 'content');
      loader.cache.set('b.html', 'content');

      loader.clear();

      expect(loader.cache.size).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should abort current load', () => {
      const abortSpy = vi.fn();
      loader.controller = { abort: abortSpy };

      loader.destroy();

      expect(abortSpy).toHaveBeenCalled();
    });

    it('should clear cache', () => {
      loader.cache.set('test.html', 'content');
      loader.destroy();
      expect(loader.cache.size).toBe(0);
    });
  });

  describe('integration', () => {
    it('should handle concurrent loads', async () => {
      global.fetch = vi.fn().mockImplementation((url) =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`<content>${url}</content>`),
        })
      );

      // Start first load
      const load1 = loader.load(['slow.html']);
      // Start second load (should abort first)
      const load2 = loader.load(['fast.html']);

      const result = await load2;
      expect(result).toContain('fast.html');
    });
  });
});
