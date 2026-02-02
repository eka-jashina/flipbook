/**
 * Unit tests for NavigationDelegate
 * Page navigation: flip, flipToPage, handleTOCNavigation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mocks
const { mockCssVars } = vi.hoisted(() => ({
  mockCssVars: {
    getNumber: vi.fn((name, defaultVal) => defaultVal),
  },
}));

vi.mock('../../../../js/utils/CSSVariables.js', () => ({
  cssVars: mockCssVars,
}));

// Mock config
vi.mock('../../../../js/config.js', () => ({
  BookState: {
    CLOSED: 'CLOSED',
    OPENING: 'OPENING',
    OPENED: 'OPENED',
    FLIPPING: 'FLIPPING',
    CLOSING: 'CLOSING',
  },
}));

const { NavigationDelegate } = await import('../../../../js/core/delegates/NavigationDelegate.js');

describe('NavigationDelegate', () => {
  let delegate;
  let mockDeps;

  beforeEach(() => {
    mockDeps = {
      stateMachine: {
        current: 'OPENED',
        get isOpened() { return this.current === 'OPENED'; },
        get isClosed() { return this.current === 'CLOSED'; },
        get isBusy() { return this.current === 'FLIPPING' || this.current === 'OPENING' || this.current === 'CLOSING'; },
        transitionTo: vi.fn(() => true),
        forceTransitionTo: vi.fn(),
      },
      renderer: {
        getMaxIndex: vi.fn(() => 100),
        prepareBuffer: vi.fn(),
        prepareSheet: vi.fn(),
        swapBuffers: vi.fn(),
      },
      animator: {
        runFlip: vi.fn().mockResolvedValue(undefined),
      },
      settings: {
        get: vi.fn((key) => {
          if (key === 'soundEnabled') return true;
          if (key === 'soundVolume') return 0.5;
          return null;
        }),
      },
      soundManager: {
        play: vi.fn(),
      },
      mediaQueries: {
        get: vi.fn((key) => key === 'mobile' ? false : null),
      },
      state: {
        index: 0,
        chapterStarts: [0, 50, 100],
      },
      onIndexChange: vi.fn(),
      onBookOpen: vi.fn().mockResolvedValue(undefined),
      onBookClose: vi.fn().mockResolvedValue(undefined),
    };

    delegate = new NavigationDelegate(mockDeps);
  });

  afterEach(() => {
    delegate.destroy();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should store callbacks', () => {
      expect(delegate.onIndexChange).toBe(mockDeps.onIndexChange);
      expect(delegate.onBookOpen).toBe(mockDeps.onBookOpen);
      expect(delegate.onBookClose).toBe(mockDeps.onBookClose);
    });

    it('should throw error if required dependencies are missing', () => {
      expect(() => new NavigationDelegate({})).toThrow('NavigationDelegate');
    });
  });

  describe('flip', () => {
    describe('when book is closed', () => {
      beforeEach(() => {
        mockDeps.stateMachine.current = 'CLOSED';
      });

      it('should open book when flipping next', async () => {
        await delegate.flip('next');

        expect(mockDeps.onBookOpen).toHaveBeenCalled();
      });

      it('should not flip when direction is prev', async () => {
        await delegate.flip('prev');

        expect(mockDeps.onBookOpen).not.toHaveBeenCalled();
        expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
      });
    });

    describe('when book is opened', () => {
      beforeEach(() => {
        mockDeps.stateMachine.current = 'OPENED';
      });

      it('should close book when at first page and flipping prev', async () => {
        mockDeps.state.index = 0;

        await delegate.flip('prev');

        expect(mockDeps.onBookClose).toHaveBeenCalled();
      });

      it('should not close if not at first page', async () => {
        mockDeps.state.index = 10;

        await delegate.flip('prev');

        expect(mockDeps.onBookClose).not.toHaveBeenCalled();
        expect(mockDeps.stateMachine.transitionTo).toHaveBeenCalledWith('FLIPPING');
      });

      it('should flip to next page', async () => {
        mockDeps.state.index = 10;

        await delegate.flip('next');

        expect(mockDeps.stateMachine.transitionTo).toHaveBeenCalledWith('FLIPPING');
        expect(mockDeps.animator.runFlip).toHaveBeenCalledWith('next', expect.any(Function));
      });

      it('should not flip beyond max index', async () => {
        mockDeps.state.index = 100; // At max
        mockDeps.renderer.getMaxIndex.mockReturnValue(100);

        await delegate.flip('next');

        expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
      });

      it('should not flip below 0', async () => {
        mockDeps.state.index = 0;

        // Create delegate with no onBookClose to test boundary
        const localDelegate = new NavigationDelegate({
          ...mockDeps,
          onBookClose: null,
        });

        await localDelegate.flip('prev');

        expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
        localDelegate.destroy();
      });
    });

    describe('when book is busy', () => {
      it('should not flip when already flipping', async () => {
        mockDeps.stateMachine.current = 'FLIPPING';

        await delegate.flip('next');

        expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
      });
    });

    describe('mobile mode', () => {
      it('should flip one page at a time on mobile', async () => {
        mockDeps.mediaQueries.get.mockImplementation((key) => key === 'mobile' ? true : null);
        mockDeps.state.index = 5;

        await delegate.flip('next');

        // In mobile, pagesPerFlip is 1
        expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalledWith(6, true);
      });
    });

    describe('desktop mode', () => {
      it('should flip two pages at a time on desktop', async () => {
        mockDeps.mediaQueries.get.mockImplementation((key) => key === 'mobile' ? false : null);
        mockDeps.state.index = 0;

        await delegate.flip('next');

        // In desktop, pagesPerFlip is 2
        expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalledWith(2, false);
      });
    });
  });

  describe('flipToPage', () => {
    beforeEach(() => {
      mockDeps.stateMachine.current = 'OPENED';
    });

    it('should not flip if busy', async () => {
      mockDeps.stateMachine.current = 'FLIPPING';

      await delegate.flipToPage(50, 'next');

      expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
    });

    it('should not flip if book not opened', async () => {
      mockDeps.stateMachine.current = 'CLOSED';

      await delegate.flipToPage(50, 'next');

      expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
    });

    it('should clamp target to valid range', async () => {
      mockDeps.state.index = 50;
      mockDeps.renderer.getMaxIndex.mockReturnValue(100);

      await delegate.flipToPage(150, 'next'); // Beyond max

      expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalledWith(100, false);
    });

    it('should clamp target to 0 if negative', async () => {
      mockDeps.state.index = 50;

      await delegate.flipToPage(-10, 'prev');

      expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalledWith(0, false);
    });

    it('should not flip if already at target', async () => {
      mockDeps.state.index = 50;

      await delegate.flipToPage(50, 'next');

      expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
    });

    it('should execute flip to target page', async () => {
      mockDeps.state.index = 10;

      await delegate.flipToPage(50, 'next');

      expect(mockDeps.animator.runFlip).toHaveBeenCalledWith('next', expect.any(Function));
    });
  });

  describe('handleTOCNavigation', () => {
    describe('when book is closed', () => {
      it('should open book', async () => {
        mockDeps.stateMachine.current = 'CLOSED';

        await delegate.handleTOCNavigation(0);

        expect(mockDeps.onBookOpen).toHaveBeenCalled();
      });
    });

    describe('when book is opened', () => {
      beforeEach(() => {
        mockDeps.stateMachine.current = 'OPENED';
        mockDeps.state.index = 50;
      });

      it('should go to beginning when chapter is undefined', async () => {
        await delegate.handleTOCNavigation(undefined);

        expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalledWith(0, false);
      });

      it('should go to end when chapter is -1', async () => {
        mockDeps.renderer.getMaxIndex.mockReturnValue(100);

        await delegate.handleTOCNavigation(-1);

        expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalledWith(100, false);
      });

      it('should go to specific chapter', async () => {
        // Chapter 1 starts at page 50, but we're at 50, so change index first
        mockDeps.state.index = 10; // Not at chapter start

        await delegate.handleTOCNavigation(1);

        expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalledWith(50, false);
      });

      it('should align to spread on desktop', async () => {
        mockDeps.state.chapterStarts = [0, 51, 100]; // Chapter 1 at odd index
        mockDeps.state.index = 10;

        await delegate.handleTOCNavigation(1);

        // Should align to 50 (even) for desktop spread
        expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalledWith(50, false);
      });

      it('should not align on mobile', async () => {
        mockDeps.mediaQueries.get.mockImplementation((key) => key === 'mobile' ? true : null);
        mockDeps.state.chapterStarts = [0, 51, 100];
        mockDeps.state.index = 10;

        await delegate.handleTOCNavigation(1);

        // Should go to exact page on mobile
        expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalledWith(51, true);
      });

      it('should do nothing for invalid chapter', async () => {
        await delegate.handleTOCNavigation(99);

        expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
      });
    });
  });

  describe('_executeFlip', () => {
    beforeEach(() => {
      mockDeps.stateMachine.current = 'OPENED';
    });

    it('should not execute if transition fails', async () => {
      mockDeps.stateMachine.transitionTo.mockReturnValue(false);

      await delegate.flip('next');

      expect(mockDeps.animator.runFlip).not.toHaveBeenCalled();
    });

    it('should play flip sound', async () => {
      await delegate.flip('next');

      // Sound is called with options for playback rate variation
      expect(mockDeps.soundManager.play).toHaveBeenCalledWith('pageFlip', expect.objectContaining({
        playbackRate: expect.any(Number),
      }));
    });

    it('should prepare buffer and sheet', async () => {
      mockDeps.state.index = 10;

      await delegate.flip('next');

      expect(mockDeps.renderer.prepareBuffer).toHaveBeenCalled();
      expect(mockDeps.renderer.prepareSheet).toHaveBeenCalled();
    });

    it('should call swapBuffers during animation', async () => {
      await delegate.flip('next');

      const swapCallback = mockDeps.animator.runFlip.mock.calls[0][1];
      swapCallback();

      expect(mockDeps.renderer.swapBuffers).toHaveBeenCalled();
    });

    it('should transition back to OPENED after flip', async () => {
      await delegate.flip('next');

      expect(mockDeps.stateMachine.transitionTo).toHaveBeenLastCalledWith('OPENED');
    });

    it('should call onIndexChange after flip', async () => {
      mockDeps.state.index = 10;

      await delegate.flip('next');

      expect(mockDeps.onIndexChange).toHaveBeenCalledWith(12); // 10 + 2 on desktop
    });

    it('should handle errors gracefully', async () => {
      mockDeps.animator.runFlip.mockRejectedValue(new Error('Animation failed'));

      await delegate.flip('next');

      expect(mockDeps.stateMachine.forceTransitionTo).toHaveBeenCalledWith('OPENED');
    });
  });

  describe('destroy', () => {
    it('should clear callbacks', () => {
      delegate.destroy();

      expect(delegate.onIndexChange).toBeNull();
      expect(delegate.onBookOpen).toBeNull();
      expect(delegate.onBookClose).toBeNull();
    });
  });
});
