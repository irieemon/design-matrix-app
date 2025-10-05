/**
 * Enhanced Skeleton Matrix Component
 *
 * Provides sophisticated matrix loading skeletons for design matrix layouts,
 * grid systems, and dashboard widgets with responsive behavior and state integration.
 */

import React, { forwardRef, useImperativeHandle } from 'react';
import { useComponentState } from '../../hooks/useComponentState';
import { ComponentVariant, ComponentSize } from '../../types/componentState';

export interface SkeletonMatrixProps {
  variant?: ComponentVariant;
  size?: ComponentSize;
  layout?: 'grid' | 'masonry' | 'dashboard' | 'kanban' | 'timeline' | 'quad';
  rows?: number;
  cols?: number;
  items?: number;
  showHeaders?: boolean;
  showSidebar?: boolean;
  animated?: boolean;
  pulse?: boolean;
  spacing?: 'tight' | 'normal' | 'loose';
  className?: string;
  'data-testid'?: string;
}

export interface SkeletonMatrixRef {
  setLoading: () => void;
  setIdle: () => void;
  startAnimation: () => void;
  stopAnimation: () => void;
  refresh: () => void;
  updateDimensions: (rows: number, cols: number) => void;
}

const SkeletonMatrix = forwardRef<SkeletonMatrixRef, SkeletonMatrixProps>(({
  variant = 'primary',
  size = 'md',
  layout = 'grid',
  rows = 4,
  cols = 4,
  items = 8,
  showHeaders = true,
  showSidebar = false,
  animated = true,
  pulse = true,
  spacing = 'normal',
  className = '',
  'data-testid': testId,
  ...props
}, ref) => {
  const [dimensions, setDimensions] = React.useState({ rows, cols });

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
    },
    updateDimensions: (newRows: number, newCols: number) => {
      setDimensions({ rows: newRows, cols: newCols });
    }
  }));

  const renderGridLayout = () => (
    <div className="skeleton-matrix-grid">
      {showHeaders && (
        <div className="skeleton-matrix-headers">
          {Array.from({ length: dimensions.cols }, (_, index) => (
            <div
              key={index}
              className="skeleton-matrix-header"
            />
          ))}
        </div>
      )}
      <div className="skeleton-matrix-grid-body">
        {Array.from({ length: dimensions.rows }, (_, rowIndex) => (
          <div key={rowIndex} className="skeleton-matrix-row">
            {Array.from({ length: dimensions.cols }, (__, colIndex) => (
              <div
                key={colIndex}
                className="skeleton-matrix-cell"
                style={{
                  animationDelay: animated ? `${(rowIndex * dimensions.cols + colIndex) * 50}ms` : '0ms'
                }}
              >
                <div className="skeleton-matrix-cell-content">
                  <div className="skeleton-matrix-cell-header" />
                  <div className="skeleton-matrix-cell-body">
                    <div className="skeleton-matrix-cell-line" />
                    <div className="skeleton-matrix-cell-line skeleton-matrix-cell-line--short" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  const renderMasonryLayout = () => (
    <div className="skeleton-matrix-masonry">
      {Array.from({ length: items }, (_, index) => {
        const heights = ['h-32', 'h-40', 'h-28', 'h-36', 'h-44', 'h-24'];
        const randomHeight = heights[index % heights.length];

        return (
          <div
            key={index}
            className={`skeleton-matrix-masonry-item ${randomHeight}`}
            style={{
              animationDelay: animated ? `${index * 100}ms` : '0ms'
            }}
          >
            <div className="skeleton-matrix-masonry-content">
              <div className="skeleton-matrix-masonry-header" />
              <div className="skeleton-matrix-masonry-body">
                {Array.from({ length: Math.floor(Math.random() * 3) + 2 }, (_, lineIndex) => (
                  <div
                    key={lineIndex}
                    className="skeleton-matrix-masonry-line"
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderDashboardLayout = () => (
    <div className="skeleton-matrix-dashboard">
      {showHeaders && (
        <div className="skeleton-matrix-dashboard-header">
          <div className="skeleton-matrix-dashboard-title" />
          <div className="skeleton-matrix-dashboard-actions">
            <div className="skeleton-matrix-dashboard-action" />
            <div className="skeleton-matrix-dashboard-action" />
          </div>
        </div>
      )}

      <div className="skeleton-matrix-dashboard-widgets">
        {/* Main metric cards */}
        <div className="skeleton-matrix-dashboard-metrics">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="skeleton-matrix-metric-card"
              style={{
                animationDelay: animated ? `${index * 75}ms` : '0ms'
              }}
            >
              <div className="skeleton-matrix-metric-icon" />
              <div className="skeleton-matrix-metric-value" />
              <div className="skeleton-matrix-metric-label" />
            </div>
          ))}
        </div>

        {/* Chart placeholders */}
        <div className="skeleton-matrix-dashboard-charts">
          <div className="skeleton-matrix-chart skeleton-matrix-chart--large">
            <div className="skeleton-matrix-chart-header" />
            <div className="skeleton-matrix-chart-body">
              <div className="skeleton-matrix-chart-placeholder" />
            </div>
          </div>

          <div className="skeleton-matrix-chart skeleton-matrix-chart--medium">
            <div className="skeleton-matrix-chart-header" />
            <div className="skeleton-matrix-chart-body">
              <div className="skeleton-matrix-chart-placeholder skeleton-matrix-chart-placeholder--pie" />
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="skeleton-matrix-dashboard-activity">
          <div className="skeleton-matrix-activity-header" />
          <div className="skeleton-matrix-activity-list">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="skeleton-matrix-activity-item"
                style={{
                  animationDelay: animated ? `${(index + 8) * 75}ms` : '0ms'
                }}
              >
                <div className="skeleton-matrix-activity-avatar" />
                <div className="skeleton-matrix-activity-content">
                  <div className="skeleton-matrix-activity-line" />
                  <div className="skeleton-matrix-activity-line skeleton-matrix-activity-line--short" />
                </div>
                <div className="skeleton-matrix-activity-time" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderKanbanLayout = () => (
    <div className="skeleton-matrix-kanban">
      {Array.from({ length: Math.min(cols, 5) }, (_, columnIndex) => (
        <div
          key={columnIndex}
          className="skeleton-matrix-kanban-column"
          style={{
            animationDelay: animated ? `${columnIndex * 100}ms` : '0ms'
          }}
        >
          <div className="skeleton-matrix-kanban-header">
            <div className="skeleton-matrix-kanban-title" />
            <div className="skeleton-matrix-kanban-count" />
          </div>

          <div className="skeleton-matrix-kanban-cards">
            {Array.from({ length: Math.floor(Math.random() * 4) + 2 }, (_, cardIndex) => (
              <div
                key={cardIndex}
                className="skeleton-matrix-kanban-card"
                style={{
                  animationDelay: animated ? `${(columnIndex * 5 + cardIndex) * 50}ms` : '0ms'
                }}
              >
                <div className="skeleton-matrix-kanban-card-title" />
                <div className="skeleton-matrix-kanban-card-body">
                  <div className="skeleton-matrix-kanban-card-line" />
                  <div className="skeleton-matrix-kanban-card-line skeleton-matrix-kanban-card-line--short" />
                </div>
                <div className="skeleton-matrix-kanban-card-footer">
                  <div className="skeleton-matrix-kanban-card-avatar" />
                  <div className="skeleton-matrix-kanban-card-date" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderTimelineLayout = () => (
    <div className="skeleton-matrix-timeline">
      {Array.from({ length: items }, (_, index) => (
        <div
          key={index}
          className="skeleton-matrix-timeline-item"
          style={{
            animationDelay: animated ? `${index * 100}ms` : '0ms'
          }}
        >
          <div className="skeleton-matrix-timeline-marker" />
          <div className="skeleton-matrix-timeline-content">
            <div className="skeleton-matrix-timeline-header">
              <div className="skeleton-matrix-timeline-title" />
              <div className="skeleton-matrix-timeline-time" />
            </div>
            <div className="skeleton-matrix-timeline-body">
              <div className="skeleton-matrix-timeline-line" />
              <div className="skeleton-matrix-timeline-line skeleton-matrix-timeline-line--short" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderLayout = () => {
    switch (layout) {
      case 'masonry':
        return renderMasonryLayout();
      case 'dashboard':
        return renderDashboardLayout();
      case 'kanban':
        return renderKanbanLayout();
      case 'timeline':
        return renderTimelineLayout();
      default:
        return renderGridLayout();
    }
  };

  const containerClasses = [
    'skeleton-matrix',
    `skeleton-matrix--${variant}`,
    `skeleton-matrix--${size}`,
    `skeleton-matrix--${layout}`,
    `skeleton-matrix--spacing-${spacing}`,
    animated && pulse ? 'skeleton-matrix--animated' : '',
    componentState.config.animated ? 'skeleton-matrix--transitions' : '',
    showSidebar ? 'skeleton-matrix--with-sidebar' : '',
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
      {showSidebar && (
        <div className="skeleton-matrix-sidebar">
          <div className="skeleton-matrix-sidebar-header" />
          <div className="skeleton-matrix-sidebar-nav">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="skeleton-matrix-sidebar-item"
                style={{
                  animationDelay: animated ? `${index * 50}ms` : '0ms'
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="skeleton-matrix-main">
        {renderLayout()}
      </div>
    </div>
  );
});

SkeletonMatrix.displayName = 'SkeletonMatrix';

export default SkeletonMatrix;