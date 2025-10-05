/**
 * Enhanced Skeleton Text Component
 *
 * Provides sophisticated text loading skeletons with multiple variants,
 * responsive behavior, and integration with component state system.
 */

import { forwardRef, useImperativeHandle } from 'react';
import { useComponentState } from '../../hooks/useComponentState';
import { ComponentVariant, ComponentSize } from '../../types/componentState';

export interface SkeletonTextProps {
  variant?: ComponentVariant;
  size?: ComponentSize;
  lines?: number;
  width?: 'full' | 'auto' | string;
  animated?: boolean;
  pulse?: boolean;
  className?: string;
  'data-testid'?: string;
}

export interface SkeletonTextRef {
  setLoading: () => void;
  setIdle: () => void;
  startAnimation: () => void;
  stopAnimation: () => void;
}

const SkeletonText = forwardRef<SkeletonTextRef, SkeletonTextProps>(({
  variant = 'primary',
  size = 'md',
  lines = 3,
  width = 'auto',
  animated = true,
  pulse = true,
  className = '',
  'data-testid': testId,
  ...props
}, ref) => {
  const componentState = useComponentState({
    initialConfig: {
      variant,
      state: 'loading',
      size,
      animated
    },
    persistState: false
  });

  useImperativeHandle(ref, () => ({
    setLoading: () => componentState.setState('loading'),
    setIdle: () => componentState.setState('idle'),
    startAnimation: () => componentState.updateConfig({ animated: true }),
    stopAnimation: () => componentState.updateConfig({ animated: false })
  }));

  // Generate skeleton lines with varying widths for realism
  const generateLines = () => {
    const lineWidths = [
      '100%', '85%', '92%', '78%', '96%', '88%', '82%', '94%', '76%', '90%'
    ];

    return Array.from({ length: lines }, (_, index) => {
      const isLastLine = index === lines - 1;
      const lineWidth = isLastLine && lines > 1
        ? lineWidths[index % lineWidths.length]
        : '100%';

      return (
        <div
          key={index}
          className={`
            skeleton-text-line
            skeleton-text-line--${size}
            skeleton-text-line--${variant}
            ${animated && pulse ? 'skeleton-text-line--animated' : ''}
            ${componentState.config.animated ? 'skeleton-text-line--transitions' : ''}
          `}
          style={{
            width: width === 'auto' ? lineWidth : width === 'full' ? '100%' : width
          }}
          data-line={index + 1}
        />
      );
    });
  };

  const containerClasses = [
    'skeleton-text',
    `skeleton-text--${variant}`,
    `skeleton-text--${size}`,
    `skeleton-text--lines-${lines}`,
    animated && pulse ? 'skeleton-text--animated' : '',
    componentState.config.animated ? 'skeleton-text--transitions' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      className={containerClasses}
      data-variant={variant}
      data-size={size}
      data-lines={lines}
      data-state={componentState.state}
      data-testid={testId}
      {...props}
    >
      {generateLines()}
    </div>
  );
});

SkeletonText.displayName = 'SkeletonText';

export default SkeletonText;