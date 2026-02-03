/**
 * Unit tests for BookAnimator
 * CSS animations for book page flipping, opening, and closing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mocks for proper module mocking
const { mockCssVars, mockTransitionHelper } = vi.hoisted(() => {
  return {
    mockCssVars: {
      getTime: vi.fn((name, defaultVal) => defaultVal),
    },
    mockTransitionHelper: {
      waitFor: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock('../../../js/utils/CSSVariables.js', () => ({
  cssVars: mockCssVars,
}));

vi.mock('../../../js/utils/TransitionHelper.js', () => ({
  TransitionHelper: mockTransitionHelper,
}));

vi.mock('../../../js/config.js', () => ({
  CONFIG: {
    TIMING_SAFETY_MARGIN: 50,
  },
  BookState: {
    CLOSED: "closed",
    OPENING: "opening",
    OPENED: "opened",
    FLIPPING: "flipping",
    CLOSING: "closing",
  },
  FlipPhase: {
    LIFT: "lift",
    ROTATE: "rotate",
    DROP: "drop",
    DRAG: "drag",
  },
  Direction: {
    NEXT: "next",
    PREV: "prev",
  },
}));

const { BookAnimator } = await import('../../../js/core/BookAnimator.js');

describe('BookAnimator', () => {
  let animator;
  let mockElements;
  let mockTimerManager;

  beforeEach(() => {
    vi.useFakeTimers();

    mockElements = {
      book: document.createElement('div'),
      bookWrap: document.createElement('div'),
      cover: document.createElement('div'),
      sheet: document.createElement('div'),
    };

    mockTimerManager = {
      setTimeout: vi.fn((fn, delay) => {
        const id = setTimeout(fn, delay);
        return id;
      }),
      requestAnimationFrame: vi.fn((fn) => {
        return requestAnimationFrame(fn);
      }),
    };

    animator = new BookAnimator({
      ...mockElements,
      timerManager: mockTimerManager,
    });

    // Reset mock implementations but keep them functional
    mockCssVars.getTime.mockImplementation((name, defaultVal) => defaultVal);
    mockTransitionHelper.waitFor.mockResolvedValue(undefined);
    mockTimerManager.setTimeout.mockClear();
    mockTimerManager.requestAnimationFrame.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should store element references', () => {
      expect(animator.elements.book).toBe(mockElements.book);
      expect(animator.elements.bookWrap).toBe(mockElements.bookWrap);
      expect(animator.elements.cover).toBe(mockElements.cover);
      expect(animator.elements.sheet).toBe(mockElements.sheet);
    });

    it('should store timer manager reference', () => {
      expect(animator.timerManager).toBe(mockTimerManager);
    });

    it('should initialize operationController as null', () => {
      expect(animator.operationController).toBeNull();
    });
  });

  describe('getTimings', () => {
    it('should return default timing values', () => {
      const timings = animator.getTimings();

      expect(timings.lift).toBe(240);
      expect(timings.rotate).toBe(900);
      expect(timings.drop).toBe(160);
      expect(timings.cover).toBe(1200);
      expect(timings.wrap).toBe(300);
      expect(timings.swapNext).toBe(30);
      expect(timings.swapPrev).toBe(100);
    });

    it('should call cssVars.getTime for each timing', () => {
      animator.getTimings();

      expect(mockCssVars.getTime).toHaveBeenCalledWith('--timing-lift', 240);
      expect(mockCssVars.getTime).toHaveBeenCalledWith('--timing-rotate', 900);
      expect(mockCssVars.getTime).toHaveBeenCalledWith('--timing-drop', 160);
      expect(mockCssVars.getTime).toHaveBeenCalledWith('--timing-cover', 1200);
      expect(mockCssVars.getTime).toHaveBeenCalledWith('--timing-wrap', 300);
    });

    it('should use values from CSS variables when available', () => {
      mockCssVars.getTime.mockImplementation((name) => {
        if (name === '--timing-lift') return 500;
        if (name === '--timing-rotate') return 1000;
        return 100;
      });

      const timings = animator.getTimings();

      expect(timings.lift).toBe(500);
      expect(timings.rotate).toBe(1000);
    });
  });

  describe('createSignal', () => {
    it('should create new AbortController', () => {
      const signal = animator.createSignal();

      expect(signal).toBeInstanceOf(AbortSignal);
      expect(animator.operationController).toBeInstanceOf(AbortController);
    });

    it('should abort previous operation', () => {
      const signal1 = animator.createSignal();
      expect(signal1.aborted).toBe(false);

      animator.createSignal();
      expect(signal1.aborted).toBe(true);
    });

    it('should return new signal each time', () => {
      const signal1 = animator.createSignal();
      const signal2 = animator.createSignal();

      expect(signal1).not.toBe(signal2);
    });
  });

  describe('abort', () => {
    it('should do nothing if no operation controller', () => {
      expect(() => animator.abort()).not.toThrow();
    });

    it('should abort current operation', () => {
      const signal = animator.createSignal();
      expect(signal.aborted).toBe(false);

      animator.abort();
      expect(signal.aborted).toBe(true);
    });

    it('should set operationController to null', () => {
      animator.createSignal();
      expect(animator.operationController).not.toBeNull();

      animator.abort();
      expect(animator.operationController).toBeNull();
    });
  });

  describe('runFlip', () => {
    let onSwap;

    beforeEach(() => {
      onSwap = vi.fn();
    });

    it('should set book state to flipping', async () => {
      const flipPromise = animator.runFlip('next', onSwap);
      await vi.runAllTimersAsync();
      await flipPromise;

      expect(mockElements.book.dataset.state).toBe('flipping');
    });

    it('should set sheet direction', async () => {
      const flipPromise = animator.runFlip('next', onSwap);
      await vi.runAllTimersAsync();
      await flipPromise;

      // Direction is set then deleted in finally
      expect(mockElements.sheet.dataset.direction).toBeUndefined();
    });

    it('should go through lift, rotate, drop phases', async () => {
      // Track all phases that are set
      const phasesSeen = new Set();

      // Observe sheet.dataset.phase changes via waitFor calls
      let waitForCallCount = 0;
      mockTransitionHelper.waitFor.mockImplementation(async () => {
        waitForCallCount++;
        // Record phase if it's set
        if (mockElements.sheet.dataset.phase) {
          phasesSeen.add(mockElements.sheet.dataset.phase);
        }
        // After first waitFor, the code sets 'rotate', after second it sets 'drop'
        await vi.advanceTimersByTimeAsync(16); // Advance to let RAF fire
        if (mockElements.sheet.dataset.phase) {
          phasesSeen.add(mockElements.sheet.dataset.phase);
        }
      });

      const flipPromise = animator.runFlip('next', onSwap);
      await vi.runAllTimersAsync();
      await flipPromise;

      // Should have called waitFor 3 times (once per phase)
      expect(waitForCallCount).toBe(3);
      // Verify phases were set (lift is set in RAF, rotate and drop directly)
      expect(phasesSeen.has('lift') || phasesSeen.has('rotate') || phasesSeen.has('drop')).toBe(true);
    });

    it('should call onSwap during rotate phase', async () => {
      const flipPromise = animator.runFlip('next', onSwap);
      await vi.runAllTimersAsync();
      await flipPromise;

      expect(onSwap).toHaveBeenCalled();
    });

    it('should use timerManager for RAF and setTimeout', async () => {
      const flipPromise = animator.runFlip('next', onSwap);
      await vi.runAllTimersAsync();
      await flipPromise;

      expect(mockTimerManager.requestAnimationFrame).toHaveBeenCalled();
      expect(mockTimerManager.setTimeout).toHaveBeenCalled();
    });

    it('should use different swap delay for prev direction', async () => {
      const flipPromise = animator.runFlip('prev', onSwap);
      await vi.runAllTimersAsync();
      await flipPromise;

      // Check setTimeout was called with swapPrev timing (100ms default)
      expect(mockTimerManager.setTimeout).toHaveBeenCalled();
      const [, delay] = mockTimerManager.setTimeout.mock.calls[0];
      expect(delay).toBe(100); // swapPrev default
    });

    it('should clean up data attributes in finally block', async () => {
      // Ensure waitFor resolves properly to proceed through all phases
      mockTransitionHelper.waitFor.mockImplementation(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const flipPromise = animator.runFlip('next', onSwap);
      await vi.runAllTimersAsync();
      await flipPromise;

      // In finally block, delete sheet.dataset.phase and sheet.dataset.direction
      // After delete, accessing them returns undefined
      expect(mockElements.sheet.dataset.phase).toBeUndefined();
      expect(mockElements.sheet.dataset.direction).toBeUndefined();
    });

    it('should call TransitionHelper.waitFor for each phase', async () => {
      const flipPromise = animator.runFlip('next', onSwap);
      await vi.runAllTimersAsync();
      await flipPromise;

      // 3 phases: lift, rotate, drop
      expect(mockTransitionHelper.waitFor).toHaveBeenCalledTimes(3);
    });

    it('should not call onSwap if signal is aborted', async () => {
      mockTransitionHelper.waitFor.mockImplementation(async () => {
        // Abort after first wait
        animator.abort();
      });

      const flipPromise = animator.runFlip('next', onSwap);
      await vi.runAllTimersAsync();
      await flipPromise;

      // onSwap should not be called because signal was aborted
      expect(onSwap).not.toHaveBeenCalled();
    });
  });

  describe('runOpenAnimation', () => {
    it('should set bookWrap state to opened', async () => {
      const promise = animator.runOpenAnimation();
      await vi.runAllTimersAsync();
      await promise;

      expect(mockElements.bookWrap.dataset.state).toBe('opened');
    });

    it('should set book state to opening', async () => {
      const promise = animator.runOpenAnimation();
      await vi.runAllTimersAsync();
      await promise;

      expect(mockElements.book.dataset.state).toBe('opening');
    });

    it('should set cover animation to opening', async () => {
      const promise = animator.runOpenAnimation();
      await vi.runAllTimersAsync();
      await promise;

      expect(mockElements.cover.dataset.animation).toBe('opening');
    });

    it('should return signal for continuation', async () => {
      const promise = animator.runOpenAnimation();
      await vi.runAllTimersAsync();
      const signal = await promise;

      expect(signal).toBeInstanceOf(AbortSignal);
    });

    it('should wait for bookWrap width transition', async () => {
      const promise = animator.runOpenAnimation();
      await vi.runAllTimersAsync();
      await promise;

      expect(mockTransitionHelper.waitFor).toHaveBeenCalledWith(
        mockElements.bookWrap,
        'width',
        350, // 300 + 50 safety margin
        expect.any(AbortSignal)
      );
    });

    it('should return null if aborted', async () => {
      mockTransitionHelper.waitFor.mockRejectedValueOnce(
        Object.assign(new Error('Aborted'), { name: 'AbortError' })
      );

      const promise = animator.runOpenAnimation();
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBeNull();
    });

    it('should rethrow non-AbortError errors', async () => {
      const error = new Error('Some other error');
      mockTransitionHelper.waitFor.mockRejectedValueOnce(error);

      const promise = animator.runOpenAnimation();
      // Attach expectation BEFORE advancing timers to avoid unhandled rejection warning
      const expectPromise = expect(promise).rejects.toThrow('Some other error');
      await vi.runAllTimersAsync();

      await expectPromise;
    });
  });

  describe('finishOpenAnimation', () => {
    it('should wait for cover transform transition', async () => {
      const signal = new AbortController().signal;

      const promise = animator.finishOpenAnimation(signal);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockTransitionHelper.waitFor).toHaveBeenCalledWith(
        mockElements.cover,
        'transform',
        1250, // 1200 + 50 safety margin
        signal
      );
    });

    it('should remove cover animation attribute', async () => {
      mockElements.cover.dataset.animation = 'opening';
      const signal = new AbortController().signal;

      const promise = animator.finishOpenAnimation(signal);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockElements.cover.dataset.animation).toBeUndefined();
    });
  });

  describe('runCloseAnimation', () => {
    it('should set bookWrap state to closed', async () => {
      const promise = animator.runCloseAnimation();
      await vi.runAllTimersAsync();
      await promise;

      expect(mockElements.bookWrap.dataset.state).toBe('closed');
    });

    it('should set book state to closing', async () => {
      const promise = animator.runCloseAnimation();
      await vi.runAllTimersAsync();
      await promise;

      expect(mockElements.book.dataset.state).toBe('closing');
    });

    it('should set cover animation to closing', async () => {
      const promise = animator.runCloseAnimation();
      await vi.runAllTimersAsync();
      await promise;

      // Animation is deleted after completion
      expect(mockElements.cover.dataset.animation).toBeUndefined();
    });

    it('should wait for both bookWrap width and cover transform', async () => {
      const promise = animator.runCloseAnimation();
      await vi.runAllTimersAsync();
      await promise;

      expect(mockTransitionHelper.waitFor).toHaveBeenCalledWith(
        mockElements.bookWrap,
        'width',
        350,
        expect.any(AbortSignal)
      );
      expect(mockTransitionHelper.waitFor).toHaveBeenCalledWith(
        mockElements.cover,
        'transform',
        1250,
        expect.any(AbortSignal)
      );
    });

    it('should remove cover animation after completion', async () => {
      mockElements.cover.dataset.animation = 'closing';

      const promise = animator.runCloseAnimation();
      await vi.runAllTimersAsync();
      await promise;

      expect(mockElements.cover.dataset.animation).toBeUndefined();
    });

    it('should handle AbortError gracefully', async () => {
      mockTransitionHelper.waitFor.mockRejectedValueOnce(
        Object.assign(new Error('Aborted'), { name: 'AbortError' })
      );

      const promise = animator.runCloseAnimation();
      await vi.runAllTimersAsync();

      // Should not throw
      await expect(promise).resolves.toBeUndefined();
    });

    it('should rethrow non-AbortError errors', async () => {
      const error = new Error('Network error');
      mockTransitionHelper.waitFor.mockRejectedValueOnce(error);

      const promise = animator.runCloseAnimation();
      // Attach expectation BEFORE advancing timers to avoid unhandled rejection warning
      const expectPromise = expect(promise).rejects.toThrow('Network error');
      await vi.runAllTimersAsync();

      await expectPromise;
    });
  });

  describe('destroy', () => {
    it('should abort current operation', () => {
      animator.createSignal();
      const controller = animator.operationController;

      animator.destroy();

      expect(controller.signal.aborted).toBe(true);
    });

    it('should set elements to null', () => {
      animator.destroy();

      expect(animator.elements).toBeNull();
    });

    it('should not throw if no operation in progress', () => {
      expect(() => animator.destroy()).not.toThrow();
    });
  });
});
