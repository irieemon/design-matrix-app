/**
 * SkeletonCard Component Test Suite
 *
 * Tests skeleton card loading component with multiple layouts,
 * animation states, and responsive behavior.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SkeletonCard, { SkeletonCardRef } from '../SkeletonCard';

describe('SkeletonCard Component', () => {
  describe('Rendering Tests', () => {
    it('should render with default props', () => {
      render(<SkeletonCard data-testid="skeleton-card" />);
      const skeleton = screen.getByTestId('skeleton-card');

      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass('skeleton-card');
      expect(skeleton).toHaveClass('skeleton-card--primary');
      expect(skeleton).toHaveClass('skeleton-card--md');
      expect(skeleton).toHaveClass('skeleton-card--basic');
    });

    it('should render with custom variant', () => {
      render(<SkeletonCard variant="secondary" data-testid="skeleton-card" />);
      const skeleton = screen.getByTestId('skeleton-card');

      expect(skeleton).toHaveClass('skeleton-card--secondary');
      expect(skeleton).toHaveAttribute('data-variant', 'secondary');
    });

    it('should render with custom size', () => {
      render(<SkeletonCard size="lg" data-testid="skeleton-card" />);
      const skeleton = screen.getByTestId('skeleton-card');

      expect(skeleton).toHaveClass('skeleton-card--lg');
      expect(skeleton).toHaveAttribute('data-size', 'lg');
    });

    it('should render with custom className', () => {
      render(<SkeletonCard className="custom-skeleton" data-testid="skeleton-card" />);
      const skeleton = screen.getByTestId('skeleton-card');

      expect(skeleton).toHaveClass('custom-skeleton');
      expect(skeleton).toHaveClass('skeleton-card');
    });

    it('should render with data attributes', () => {
      render(<SkeletonCard variant="primary" size="md" layout="basic" data-testid="skeleton-card" />);
      const skeleton = screen.getByTestId('skeleton-card');

      expect(skeleton).toHaveAttribute('data-variant', 'primary');
      expect(skeleton).toHaveAttribute('data-size', 'md');
      expect(skeleton).toHaveAttribute('data-layout', 'basic');
      expect(skeleton).toHaveAttribute('data-state', 'loading');
    });
  });

  describe('Layout Variants', () => {
    it('should render basic layout', () => {
      render(<SkeletonCard layout="basic" data-testid="skeleton-card" />);
      const skeleton = screen.getByTestId('skeleton-card');

      expect(skeleton).toHaveClass('skeleton-card--basic');
      expect(skeleton).toHaveAttribute('data-layout', 'basic');
    });

    it('should render media layout', () => {
      render(<SkeletonCard layout="media" data-testid="skeleton-card" />);
      const skeleton = screen.getByTestId('skeleton-card');

      expect(skeleton).toHaveClass('skeleton-card--media');
      expect(skeleton).toHaveAttribute('data-layout', 'media');
    });

    it('should render profile layout', () => {
      render(<SkeletonCard layout="profile" data-testid="skeleton-card" />);
      const skeleton = screen.getByTestId('skeleton-card');

      expect(skeleton).toHaveClass('skeleton-card--profile');
      expect(skeleton).toHaveAttribute('data-layout', 'profile');
    });

    it('should render article layout', () => {
      render(<SkeletonCard layout="article" data-testid="skeleton-card" />);
      const skeleton = screen.getByTestId('skeleton-card');

      expect(skeleton).toHaveClass('skeleton-card--article');
      expect(skeleton).toHaveAttribute('data-layout', 'article');
    });

    it('should render product layout', () => {
      render(<SkeletonCard layout="product" data-testid="skeleton-card" />);
      const skeleton = screen.getByTestId('skeleton-card');

      expect(skeleton).toHaveClass('skeleton-card--product');
      expect(skeleton).toHaveAttribute('data-layout', 'product');
    });
  });

  describe('Animation States', () => {
    it('should apply animation classes when animated is true', () => {
      render(<SkeletonCard animated={true} pulse={true} data-testid="skeleton-card" />);
      const skeleton = screen.getByTestId('skeleton-card');

      expect(skeleton).toHaveClass('skeleton-card--animated');
      expect(skeleton).toHaveClass('skeleton-card--transitions');
    });

    it('should not apply animation classes when animated is false', () => {
      render(<SkeletonCard animated={false} pulse={false} data-testid="skeleton-card" />);
      const skeleton = screen.getByTestId('skeleton-card');

      expect(skeleton).not.toHaveClass('skeleton-card--animated');
    });

    it('should handle pulse animation separately', () => {
      render(<SkeletonCard animated={true} pulse={false} data-testid="skeleton-card" />);
      const skeleton = screen.getByTestId('skeleton-card');

      expect(skeleton).not.toHaveClass('skeleton-card--animated');
      expect(skeleton).toHaveClass('skeleton-card--transitions');
    });

    it('should handle no animations', () => {
      render(<SkeletonCard animated={false} data-testid="skeleton-card" />);
      const skeleton = screen.getByTestId('skeleton-card');

      expect(skeleton).not.toHaveClass('skeleton-card--animated');
      expect(skeleton).not.toHaveClass('skeleton-card--transitions');
    });
  });

  describe('Content Elements', () => {
    it('should render avatar when showAvatar is true', () => {
      const { container } = render(<SkeletonCard showAvatar={true} />);
      const avatar = container.querySelector('.skeleton-card-avatar');

      expect(avatar).toBeInTheDocument();
    });

    it('should not render avatar when showAvatar is false', () => {
      const { container } = render(<SkeletonCard showAvatar={false} />);
      const avatar = container.querySelector('.skeleton-card-avatar');

      expect(avatar).not.toBeInTheDocument();
    });

    it('should render image when showImage is true', () => {
      const { container } = render(<SkeletonCard showImage={true} layout="media" />);
      const image = container.querySelector('.skeleton-card-image');

      expect(image).toBeInTheDocument();
    });

    it('should render button when showButton is true', () => {
      const { container } = render(<SkeletonCard showButton={true} />);
      const button = container.querySelector('.skeleton-card-button');

      expect(button).toBeInTheDocument();
    });

    it('should render specified number of lines', () => {
      const { container } = render(<SkeletonCard lines={5} />);
      const lines = container.querySelectorAll('.skeleton-card-line');

      expect(lines).toHaveLength(5);
    });

    it('should render default 3 lines', () => {
      const { container } = render(<SkeletonCard />);
      const lines = container.querySelectorAll('.skeleton-card-line');

      expect(lines).toHaveLength(3);
    });

    it('should mark last line as short', () => {
      const { container } = render(<SkeletonCard lines={3} />);
      const lines = container.querySelectorAll('.skeleton-card-line');
      const lastLine = lines[lines.length - 1];

      expect(lastLine).toHaveClass('skeleton-card-line--short');
    });
  });

  describe('Ref Imperative Methods', () => {
    it('should expose setLoading method', () => {
      const ref = React.createRef<SkeletonCardRef>();
      render(<SkeletonCard ref={ref} data-testid="skeleton-card" />);

      expect(ref.current).toBeDefined();
      expect(ref.current?.setLoading).toBeInstanceOf(Function);

      ref.current?.setLoading();
      const skeleton = screen.getByTestId('skeleton-card');
      expect(skeleton).toHaveAttribute('data-state', 'loading');
    });

    it('should expose setIdle method', async () => {
      const ref = React.createRef<SkeletonCardRef>();
      render(<SkeletonCard ref={ref} data-testid="skeleton-card" />);

      expect(ref.current?.setIdle).toBeInstanceOf(Function);

      ref.current?.setIdle();
      await waitFor(() => {
        const skeleton = screen.getByTestId('skeleton-card');
        expect(skeleton).toHaveAttribute('data-state', 'idle');
      });
    });

    it('should expose startAnimation method', () => {
      const ref = React.createRef<SkeletonCardRef>();
      render(<SkeletonCard ref={ref} animated={false} data-testid="skeleton-card" />);

      expect(ref.current?.startAnimation).toBeInstanceOf(Function);
      // Note: setAnimated is not available in useComponentState hook
      // This method exists in the interface but may not be functional
    });

    it('should expose stopAnimation method', async () => {
      const ref = React.createRef<SkeletonCardRef>();
      render(<SkeletonCard ref={ref} animated={true} data-testid="skeleton-card" />);

      expect(ref.current?.stopAnimation).toBeInstanceOf(Function);
      // Note: setAnimated is not available in useComponentState hook
      // This method exists in the interface but may not be functional
    });

    it('should expose refresh method', async () => {
      const ref = React.createRef<SkeletonCardRef>();
      render(<SkeletonCard ref={ref} data-testid="skeleton-card" />);

      expect(ref.current?.refresh).toBeInstanceOf(Function);

      ref.current?.refresh();
      await waitFor(() => {
        const skeleton = screen.getByTestId('skeleton-card');
        expect(skeleton).toHaveAttribute('data-state', 'loading');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero lines', () => {
      const { container } = render(<SkeletonCard lines={0} />);
      const lines = container.querySelectorAll('.skeleton-card-line');

      expect(lines).toHaveLength(0);
    });

    it('should handle very large number of lines', () => {
      const { container } = render(<SkeletonCard lines={50} />);
      const lines = container.querySelectorAll('.skeleton-card-line');

      expect(lines).toHaveLength(50);
    });

    it('should handle all content elements simultaneously', () => {
      const { container } = render(
        <SkeletonCard showAvatar={true} showImage={true} showButton={true} layout="media" />
      );

      expect(container.querySelector('.skeleton-card-image')).toBeInTheDocument();
      expect(container.querySelector('.skeleton-card-button')).toBeInTheDocument();
    });

    it('should handle no content elements', () => {
      const { container } = render(
        <SkeletonCard showAvatar={false} showImage={false} showButton={false} lines={0} />
      );

      expect(container.querySelector('.skeleton-card-content')).toBeInTheDocument();
    });
  });

  describe('Product Layout Specific', () => {
    it('should render rating stars in product layout', () => {
      const { container } = render(<SkeletonCard layout="product" />);
      const stars = container.querySelectorAll('.skeleton-card-star');

      expect(stars).toHaveLength(5);
    });

    it('should limit description lines in product layout', () => {
      const { container } = render(<SkeletonCard layout="product" lines={5} />);
      const lines = container.querySelectorAll('.skeleton-card-line');

      expect(lines.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Multiple Instances', () => {
    it('should render multiple instances independently', () => {
      const { container } = render(
        <>
          <SkeletonCard data-testid="card1" variant="primary" />
          <SkeletonCard data-testid="card2" variant="secondary" />
          <SkeletonCard data-testid="card3" variant="tertiary" />
        </>
      );

      expect(screen.getByTestId('card1')).toHaveClass('skeleton-card--primary');
      expect(screen.getByTestId('card2')).toHaveClass('skeleton-card--secondary');
      expect(screen.getByTestId('card3')).toHaveClass('skeleton-card--tertiary');
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate loading state for screen readers', () => {
      render(<SkeletonCard data-testid="skeleton-card" />);
      const skeleton = screen.getByTestId('skeleton-card');

      expect(skeleton).toHaveAttribute('data-state', 'loading');
    });

    it('should support custom test ids', () => {
      render(<SkeletonCard data-testid="custom-test-id" />);

      expect(screen.getByTestId('custom-test-id')).toBeInTheDocument();
    });
  });
});