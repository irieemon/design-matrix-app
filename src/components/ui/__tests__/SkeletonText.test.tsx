/**
 * SkeletonText Component Test Suite
 *
 * Tests skeleton text loading component with multiple variants,
 * line counts, and animation states.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SkeletonText, { SkeletonTextRef } from '../SkeletonText';

describe('SkeletonText Component', () => {
  describe('Rendering Tests', () => {
    it('should render with default props', () => {
      render(<SkeletonText data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass('skeleton-text');
      expect(skeleton).toHaveClass('skeleton-text--primary');
      expect(skeleton).toHaveClass('skeleton-text--md');
      expect(skeleton).toHaveClass('skeleton-text--lines-3');
    });

    it('should render with custom variant', () => {
      render(<SkeletonText variant="secondary" data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).toHaveClass('skeleton-text--secondary');
      expect(skeleton).toHaveAttribute('data-variant', 'secondary');
    });

    it('should render with custom size', () => {
      render(<SkeletonText size="lg" data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).toHaveClass('skeleton-text--lg');
      expect(skeleton).toHaveAttribute('data-size', 'lg');
    });

    it('should render with custom className', () => {
      render(<SkeletonText className="custom-text" data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).toHaveClass('custom-text');
      expect(skeleton).toHaveClass('skeleton-text');
    });

    it('should render with data attributes', () => {
      render(<SkeletonText variant="primary" size="md" lines={5} data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).toHaveAttribute('data-variant', 'primary');
      expect(skeleton).toHaveAttribute('data-size', 'md');
      expect(skeleton).toHaveAttribute('data-lines', '5');
      expect(skeleton).toHaveAttribute('data-state', 'loading');
    });
  });

  describe('Line Rendering', () => {
    it('should render default 3 lines', () => {
      const { container } = render(<SkeletonText />);
      const lines = container.querySelectorAll('.skeleton-text-line');

      expect(lines).toHaveLength(3);
    });

    it('should render custom number of lines', () => {
      const { container } = render(<SkeletonText lines={7} />);
      const lines = container.querySelectorAll('.skeleton-text-line');

      expect(lines).toHaveLength(7);
    });

    it('should render single line', () => {
      const { container } = render(<SkeletonText lines={1} />);
      const lines = container.querySelectorAll('.skeleton-text-line');

      expect(lines).toHaveLength(1);
    });

    it('should render zero lines', () => {
      const { container } = render(<SkeletonText lines={0} />);
      const lines = container.querySelectorAll('.skeleton-text-line');

      expect(lines).toHaveLength(0);
    });

    it('should render many lines', () => {
      const { container } = render(<SkeletonText lines={50} />);
      const lines = container.querySelectorAll('.skeleton-text-line');

      expect(lines).toHaveLength(50);
    });

    it('should apply line number data attribute', () => {
      const { container } = render(<SkeletonText lines={3} />);
      const lines = container.querySelectorAll('.skeleton-text-line');

      expect(lines[0]).toHaveAttribute('data-line', '1');
      expect(lines[1]).toHaveAttribute('data-line', '2');
      expect(lines[2]).toHaveAttribute('data-line', '3');
    });

    it('should apply size class to lines', () => {
      const { container } = render(<SkeletonText size="lg" />);
      const lines = container.querySelectorAll('.skeleton-text-line');

      lines.forEach(line => {
        expect(line).toHaveClass('skeleton-text-line--lg');
      });
    });

    it('should apply variant class to lines', () => {
      const { container } = render(<SkeletonText variant="secondary" />);
      const lines = container.querySelectorAll('.skeleton-text-line');

      lines.forEach(line => {
        expect(line).toHaveClass('skeleton-text-line--secondary');
      });
    });
  });

  describe('Width Variants', () => {
    it('should apply auto width with varying line widths', () => {
      const { container } = render(<SkeletonText lines={3} width="auto" />);
      const lines = container.querySelectorAll('.skeleton-text-line');

      const lastLine = lines[lines.length - 1];
      const lastLineWidth = lastLine.style.width;

      expect(lastLineWidth).not.toBe('100%');
      expect(lastLineWidth).toMatch(/^\d+%$/);
    });

    it('should apply full width to all lines', () => {
      const { container } = render(<SkeletonText lines={3} width="full" />);
      const lines = container.querySelectorAll('.skeleton-text-line');

      lines.forEach(line => {
        expect(line).toHaveStyle({ width: '100%' });
      });
    });

    it('should apply custom width to all lines', () => {
      const { container } = render(<SkeletonText lines={3} width="250px" />);
      const lines = container.querySelectorAll('.skeleton-text-line');

      lines.forEach(line => {
        expect(line).toHaveStyle({ width: '250px' });
      });
    });

    it('should handle percentage width', () => {
      const { container } = render(<SkeletonText lines={2} width="50%" />);
      const lines = container.querySelectorAll('.skeleton-text-line');

      lines.forEach(line => {
        expect(line).toHaveStyle({ width: '50%' });
      });
    });

    it('should vary last line width when more than one line', () => {
      const { container } = render(<SkeletonText lines={2} width="auto" />);
      const lines = container.querySelectorAll('.skeleton-text-line');

      const firstLineWidth = lines[0].style.width;
      const lastLineWidth = lines[1].style.width;

      expect(firstLineWidth).toBe('100%');
      expect(lastLineWidth).not.toBe('100%');
    });

    it('should use full width for single line with auto width', () => {
      const { container } = render(<SkeletonText lines={1} width="auto" />);
      const line = container.querySelector('.skeleton-text-line');

      expect(line).toHaveStyle({ width: '100%' });
    });
  });

  describe('Animation States', () => {
    it('should apply animation classes when animated is true', () => {
      render(<SkeletonText animated={true} pulse={true} data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).toHaveClass('skeleton-text--animated');
      expect(skeleton).toHaveClass('skeleton-text--transitions');
    });

    it('should not apply animation classes when animated is false', () => {
      render(<SkeletonText animated={false} pulse={false} data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).not.toHaveClass('skeleton-text--animated');
    });

    it('should handle pulse animation separately', () => {
      render(<SkeletonText animated={true} pulse={false} data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).not.toHaveClass('skeleton-text--animated');
      expect(skeleton).toHaveClass('skeleton-text--transitions');
    });

    it('should apply animation classes to lines', () => {
      const { container } = render(<SkeletonText animated={true} pulse={true} />);
      const lines = container.querySelectorAll('.skeleton-text-line');

      lines.forEach(line => {
        expect(line).toHaveClass('skeleton-text-line--animated');
        expect(line).toHaveClass('skeleton-text-line--transitions');
      });
    });

    it('should not apply animation classes to lines when disabled', () => {
      const { container } = render(<SkeletonText animated={false} pulse={false} />);
      const lines = container.querySelectorAll('.skeleton-text-line');

      lines.forEach(line => {
        expect(line).not.toHaveClass('skeleton-text-line--animated');
      });
    });
  });

  describe('Size Variants', () => {
    it('should apply xs size', () => {
      render(<SkeletonText size="xs" data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).toHaveClass('skeleton-text--xs');
      expect(skeleton).toHaveAttribute('data-size', 'xs');
    });

    it('should apply sm size', () => {
      render(<SkeletonText size="sm" data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).toHaveClass('skeleton-text--sm');
      expect(skeleton).toHaveAttribute('data-size', 'sm');
    });

    it('should apply md size by default', () => {
      render(<SkeletonText data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).toHaveClass('skeleton-text--md');
      expect(skeleton).toHaveAttribute('data-size', 'md');
    });

    it('should apply lg size', () => {
      render(<SkeletonText size="lg" data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).toHaveClass('skeleton-text--lg');
      expect(skeleton).toHaveAttribute('data-size', 'lg');
    });

    it('should apply xl size', () => {
      render(<SkeletonText size="xl" data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).toHaveClass('skeleton-text--xl');
      expect(skeleton).toHaveAttribute('data-size', 'xl');
    });
  });

  describe('Variant Types', () => {
    it('should apply primary variant by default', () => {
      render(<SkeletonText data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).toHaveClass('skeleton-text--primary');
      expect(skeleton).toHaveAttribute('data-variant', 'primary');
    });

    it('should apply secondary variant', () => {
      render(<SkeletonText variant="secondary" data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).toHaveClass('skeleton-text--secondary');
      expect(skeleton).toHaveAttribute('data-variant', 'secondary');
    });

    it('should apply tertiary variant', () => {
      render(<SkeletonText variant="tertiary" data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).toHaveClass('skeleton-text--tertiary');
      expect(skeleton).toHaveAttribute('data-variant', 'tertiary');
    });

    it('should apply neutral variant', () => {
      render(<SkeletonText variant="neutral" data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).toHaveClass('skeleton-text--neutral');
      expect(skeleton).toHaveAttribute('data-variant', 'neutral');
    });
  });

  describe('Ref Imperative Methods', () => {
    it('should expose setLoading method', () => {
      const ref = React.createRef<SkeletonTextRef>();
      render(<SkeletonText ref={ref} data-testid="skeleton-text" />);

      expect(ref.current).toBeDefined();
      expect(ref.current?.setLoading).toBeInstanceOf(Function);

      ref.current?.setLoading();
      const skeleton = screen.getByTestId('skeleton-text');
      expect(skeleton).toHaveAttribute('data-state', 'loading');
    });

    it('should expose setIdle method', async () => {
      const ref = React.createRef<SkeletonTextRef>();
      render(<SkeletonText ref={ref} data-testid="skeleton-text" />);

      expect(ref.current?.setIdle).toBeInstanceOf(Function);

      ref.current?.setIdle();
      await waitFor(() => {
        const skeleton = screen.getByTestId('skeleton-text');
        expect(skeleton).toHaveAttribute('data-state', 'idle');
      });
    });

    it('should expose startAnimation method', () => {
      const ref = React.createRef<SkeletonTextRef>();
      render(<SkeletonText ref={ref} animated={false} data-testid="skeleton-text" />);

      expect(ref.current?.startAnimation).toBeInstanceOf(Function);
      // Note: setAnimated is not available in useComponentState hook
    });

    it('should expose stopAnimation method', async () => {
      const ref = React.createRef<SkeletonTextRef>();
      render(<SkeletonText ref={ref} animated={true} data-testid="skeleton-text" />);

      expect(ref.current?.stopAnimation).toBeInstanceOf(Function);
      // Note: setAnimated is not available in useComponentState hook
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero lines gracefully', () => {
      const { container } = render(<SkeletonText lines={0} data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');
      const lines = container.querySelectorAll('.skeleton-text-line');

      expect(skeleton).toBeInTheDocument();
      expect(lines).toHaveLength(0);
    });

    it('should handle very large line count', () => {
      const { container } = render(<SkeletonText lines={100} />);
      const lines = container.querySelectorAll('.skeleton-text-line');

      expect(lines).toHaveLength(100);
    });

    it('should handle negative line count', () => {
      const { container } = render(<SkeletonText lines={-1} />);
      const lines = container.querySelectorAll('.skeleton-text-line');

      expect(lines).toHaveLength(0);
    });

    it('should handle all animations disabled', () => {
      render(<SkeletonText animated={false} pulse={false} data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).not.toHaveClass('skeleton-text--animated');
      expect(skeleton).not.toHaveClass('skeleton-text--transitions');
    });

    it('should handle custom width edge cases', () => {
      const { container } = render(<SkeletonText lines={1} width="0px" />);
      const line = container.querySelector('.skeleton-text-line');

      expect(line).toHaveStyle({ width: '0px' });
    });
  });

  describe('Multiple Instances', () => {
    it('should render multiple instances independently', () => {
      render(
        <>
          <SkeletonText data-testid="text1" variant="primary" lines={2} />
          <SkeletonText data-testid="text2" variant="secondary" lines={5} />
          <SkeletonText data-testid="text3" variant="tertiary" lines={3} />
        </>
      );

      expect(screen.getByTestId('text1')).toHaveClass('skeleton-text--primary');
      expect(screen.getByTestId('text2')).toHaveClass('skeleton-text--secondary');
      expect(screen.getByTestId('text3')).toHaveClass('skeleton-text--tertiary');

      expect(screen.getByTestId('text1')).toHaveAttribute('data-lines', '2');
      expect(screen.getByTestId('text2')).toHaveAttribute('data-lines', '5');
      expect(screen.getByTestId('text3')).toHaveAttribute('data-lines', '3');
    });

    it('should handle different sizes simultaneously', () => {
      render(
        <>
          <SkeletonText data-testid="text1" size="xs" />
          <SkeletonText data-testid="text2" size="sm" />
          <SkeletonText data-testid="text3" size="md" />
          <SkeletonText data-testid="text4" size="lg" />
          <SkeletonText data-testid="text5" size="xl" />
        </>
      );

      expect(screen.getByTestId('text1')).toHaveClass('skeleton-text--xs');
      expect(screen.getByTestId('text2')).toHaveClass('skeleton-text--sm');
      expect(screen.getByTestId('text3')).toHaveClass('skeleton-text--md');
      expect(screen.getByTestId('text4')).toHaveClass('skeleton-text--lg');
      expect(screen.getByTestId('text5')).toHaveClass('skeleton-text--xl');
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate loading state for screen readers', () => {
      render(<SkeletonText data-testid="skeleton-text" />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).toHaveAttribute('data-state', 'loading');
    });

    it('should support custom test ids', () => {
      render(<SkeletonText data-testid="custom-test-id" />);

      expect(screen.getByTestId('custom-test-id')).toBeInTheDocument();
    });

    it('should maintain semantic structure with data attributes', () => {
      render(<SkeletonText data-testid="skeleton-text" variant="primary" size="md" lines={3} />);
      const skeleton = screen.getByTestId('skeleton-text');

      expect(skeleton).toHaveAttribute('data-variant');
      expect(skeleton).toHaveAttribute('data-size');
      expect(skeleton).toHaveAttribute('data-lines');
      expect(skeleton).toHaveAttribute('data-state');
    });
  });

  describe('Line Width Pattern', () => {
    it('should generate realistic width patterns for multiple lines', () => {
      const { container } = render(<SkeletonText lines={10} width="auto" />);
      const lines = container.querySelectorAll('.skeleton-text-line');

      const widths = Array.from(lines).map(line => (line as HTMLElement).style.width);
      const uniqueWidths = new Set(widths.filter(w => w !== '100%'));

      expect(uniqueWidths.size).toBeGreaterThan(0);
    });

    it('should maintain consistent width for first line', () => {
      const { container } = render(<SkeletonText lines={5} width="auto" />);
      const lines = container.querySelectorAll('.skeleton-text-line');

      const firstLine = lines[0] as HTMLElement;
      expect(firstLine.style.width).toBe('100%');
    });
  });
});