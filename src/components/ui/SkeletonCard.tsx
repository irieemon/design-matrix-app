/**
 * Enhanced Skeleton Card Component
 *
 * Provides sophisticated card loading skeletons with multiple layouts,
 * responsive behavior, and integration with component state system.
 */

import { forwardRef, useImperativeHandle } from 'react';
import { useComponentState } from '../../hooks/useComponentState';
import { ComponentVariant, ComponentSize } from '../../types/componentState';

export interface SkeletonCardProps {
  variant?: ComponentVariant;
  size?: ComponentSize;
  layout?: 'basic' | 'media' | 'profile' | 'article' | 'product';
  showAvatar?: boolean;
  showImage?: boolean;
  showButton?: boolean;
  lines?: number;
  animated?: boolean;
  pulse?: boolean;
  className?: string;
  'data-testid'?: string;
}

export interface SkeletonCardRef {
  setLoading: () => void;
  setIdle: () => void;
  startAnimation: () => void;
  stopAnimation: () => void;
  refresh: () => void;
}

const SkeletonCard = forwardRef<SkeletonCardRef, SkeletonCardProps>(({
  variant = 'primary',
  size = 'md',
  layout = 'basic',
  showAvatar = false,
  showImage = false,
  showButton = false,
  lines = 3,
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
    stopAnimation: () => componentState.updateConfig({ animated: false }),
    refresh: () => {
      componentState.setState('idle');
      setTimeout(() => componentState.setState('loading'), 100);
    }
  }));

  const renderBasicLayout = () => (
    <>
      {showAvatar && (
        <div className="skeleton-card-avatar">
          <div className="skeleton-card-avatar-circle" />
        </div>
      )}
      <div className="skeleton-card-content">
        <div className="skeleton-card-title" />
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className={`skeleton-card-line ${index === lines - 1 ? 'skeleton-card-line--short' : ''}`}
          />
        ))}
        {showButton && (
          <div className="skeleton-card-button" />
        )}
      </div>
    </>
  );

  const renderMediaLayout = () => (
    <>
      {showImage && (
        <div className="skeleton-card-image" />
      )}
      <div className="skeleton-card-content">
        <div className="skeleton-card-title" />
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className={`skeleton-card-line ${index === lines - 1 ? 'skeleton-card-line--short' : ''}`}
          />
        ))}
        {showButton && (
          <div className="skeleton-card-actions">
            <div className="skeleton-card-button" />
            <div className="skeleton-card-button skeleton-card-button--secondary" />
          </div>
        )}
      </div>
    </>
  );

  const renderProfileLayout = () => (
    <>
      <div className="skeleton-card-header">
        <div className="skeleton-card-avatar">
          <div className="skeleton-card-avatar-circle" />
        </div>
        <div className="skeleton-card-header-content">
          <div className="skeleton-card-name" />
          <div className="skeleton-card-subtitle" />
        </div>
      </div>
      <div className="skeleton-card-content">
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className={`skeleton-card-line ${index === lines - 1 ? 'skeleton-card-line--short' : ''}`}
          />
        ))}
      </div>
      {showButton && (
        <div className="skeleton-card-footer">
          <div className="skeleton-card-button" />
        </div>
      )}
    </>
  );

  const renderArticleLayout = () => (
    <>
      {showImage && (
        <div className="skeleton-card-image skeleton-card-image--article" />
      )}
      <div className="skeleton-card-content">
        <div className="skeleton-card-category" />
        <div className="skeleton-card-title skeleton-card-title--large" />
        <div className="skeleton-card-subtitle" />
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className={`skeleton-card-line ${index === lines - 1 ? 'skeleton-card-line--short' : ''}`}
          />
        ))}
        <div className="skeleton-card-meta">
          <div className="skeleton-card-meta-item" />
          <div className="skeleton-card-meta-item" />
        </div>
      </div>
    </>
  );

  const renderProductLayout = () => (
    <>
      {showImage && (
        <div className="skeleton-card-image skeleton-card-image--product" />
      )}
      <div className="skeleton-card-content">
        <div className="skeleton-card-title" />
        <div className="skeleton-card-price" />
        <div className="skeleton-card-rating">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="skeleton-card-star" />
          ))}
          <div className="skeleton-card-review-count" />
        </div>
        {lines > 0 && (
          <div className="skeleton-card-description">
            {Array.from({ length: Math.min(lines, 2) }, (_, index) => (
              <div
                key={index}
                className={`skeleton-card-line ${index === lines - 1 ? 'skeleton-card-line--short' : ''}`}
              />
            ))}
          </div>
        )}
        {showButton && (
          <div className="skeleton-card-actions">
            <div className="skeleton-card-button skeleton-card-button--primary" />
            <div className="skeleton-card-button skeleton-card-button--icon" />
          </div>
        )}
      </div>
    </>
  );

  const renderLayout = () => {
    switch (layout) {
      case 'media':
        return renderMediaLayout();
      case 'profile':
        return renderProfileLayout();
      case 'article':
        return renderArticleLayout();
      case 'product':
        return renderProductLayout();
      default:
        return renderBasicLayout();
    }
  };

  const containerClasses = [
    'skeleton-card',
    `skeleton-card--${variant}`,
    `skeleton-card--${size}`,
    `skeleton-card--${layout}`,
    animated && pulse ? 'skeleton-card--animated' : '',
    componentState.config.animated ? 'skeleton-card--transitions' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      className={containerClasses}
      data-variant={variant}
      data-size={size}
      data-layout={layout}
      data-state={componentState.state}
      data-testid={testId}
      {...props}
    >
      {renderLayout()}
    </div>
  );
});

SkeletonCard.displayName = 'SkeletonCard';

export default SkeletonCard;