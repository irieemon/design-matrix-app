/**
 * Enhanced Skeleton Table Component
 *
 * Provides sophisticated table loading skeletons with multiple layouts,
 * responsive behavior, and integration with component state system.
 */

import React, { forwardRef, useImperativeHandle } from 'react';
import { useComponentState } from '../../hooks/useComponentState';
import { ComponentVariant, ComponentSize } from '../../types/componentState';

export interface SkeletonTableProps {
  variant?: ComponentVariant;
  size?: ComponentSize;
  layout?: 'basic' | 'advanced' | 'compact' | 'data-grid' | 'tree';
  rows?: number;
  cols?: number;
  showHeaders?: boolean;
  showActions?: boolean;
  showFilters?: boolean;
  showPagination?: boolean;
  animated?: boolean;
  pulse?: boolean;
  striped?: boolean;
  bordered?: boolean;
  className?: string;
  'data-testid'?: string;
}

export interface SkeletonTableRef {
  setLoading: () => void;
  setIdle: () => void;
  startAnimation: () => void;
  stopAnimation: () => void;
  refresh: () => void;
  updateDimensions: (rows: number, cols: number) => void;
}

const SkeletonTable = forwardRef<SkeletonTableRef, SkeletonTableProps>(({
  variant = 'primary',
  size = 'md',
  layout = 'basic',
  rows = 8,
  cols = 6,
  showHeaders = true,
  showActions = true,
  showFilters = false,
  showPagination = true,
  animated = true,
  pulse = true,
  striped = true,
  bordered = false,
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

  const generateColumnWidth = (index: number) => {
    const widths = ['w-8', 'w-32', 'w-24', 'w-20', 'w-16', 'w-28', 'w-24', 'w-12'];
    return widths[index % widths.length];
  };

  const renderTableHeaders = () => {
    if (!showHeaders) return null;

    return (
      <thead className="skeleton-table-head">
        <tr className="skeleton-table-header-row">
          {Array.from({ length: dimensions.cols }, (_, index) => (
            <th
              key={index}
              className={`skeleton-table-header-cell ${generateColumnWidth(index)}`}
              style={{
                animationDelay: animated ? `${index * 25}ms` : '0ms'
              }}
            >
              <div className="skeleton-table-header-content" />
            </th>
          ))}
          {showActions && (
            <th className="skeleton-table-header-cell w-16">
              <div className="skeleton-table-header-content skeleton-table-header-content--actions" />
            </th>
          )}
        </tr>
      </thead>
    );
  };

  const renderBasicRows = () => (
    <tbody className="skeleton-table-body">
      {Array.from({ length: dimensions.rows }, (_, rowIndex) => (
        <tr
          key={rowIndex}
          className={`skeleton-table-row ${striped && rowIndex % 2 === 1 ? 'skeleton-table-row--striped' : ''}`}
          style={{
            animationDelay: animated ? `${(rowIndex + dimensions.cols) * 25}ms` : '0ms'
          }}
        >
          {Array.from({ length: dimensions.cols }, (_, colIndex) => (
            <td
              key={colIndex}
              className={`skeleton-table-cell ${generateColumnWidth(colIndex)}`}
            >
              <div className="skeleton-table-cell-content">
                {colIndex === 0 ? (
                  <div className="skeleton-table-cell-primary" />
                ) : colIndex === 1 ? (
                  <div className="skeleton-table-cell-text" />
                ) : colIndex === dimensions.cols - 1 ? (
                  <div className="skeleton-table-cell-status" />
                ) : (
                  <div className="skeleton-table-cell-text skeleton-table-cell-text--secondary" />
                )}
              </div>
            </td>
          ))}
          {showActions && (
            <td className="skeleton-table-cell w-16">
              <div className="skeleton-table-cell-actions">
                <div className="skeleton-table-action-button" />
                <div className="skeleton-table-action-button" />
              </div>
            </td>
          )}
        </tr>
      ))}
    </tbody>
  );

  const renderAdvancedRows = () => (
    <tbody className="skeleton-table-body">
      {Array.from({ length: dimensions.rows }, (_, rowIndex) => (
        <tr
          key={rowIndex}
          className={`skeleton-table-row skeleton-table-row--advanced ${striped && rowIndex % 2 === 1 ? 'skeleton-table-row--striped' : ''}`}
          style={{
            animationDelay: animated ? `${(rowIndex + dimensions.cols) * 25}ms` : '0ms'
          }}
        >
          <td className="skeleton-table-cell w-8">
            <div className="skeleton-table-checkbox" />
          </td>
          <td className="skeleton-table-cell w-16">
            <div className="skeleton-table-avatar" />
          </td>
          <td className="skeleton-table-cell w-32">
            <div className="skeleton-table-name-group">
              <div className="skeleton-table-name" />
              <div className="skeleton-table-subtitle" />
            </div>
          </td>
          {Array.from({ length: dimensions.cols - 3 }, (_, colIndex) => (
            <td
              key={colIndex + 3}
              className={`skeleton-table-cell ${generateColumnWidth(colIndex + 3)}`}
            >
              <div className="skeleton-table-cell-content">
                {colIndex === 0 ? (
                  <div className="skeleton-table-badge" />
                ) : colIndex === 1 ? (
                  <div className="skeleton-table-metric">
                    <div className="skeleton-table-metric-value" />
                    <div className="skeleton-table-metric-label" />
                  </div>
                ) : (
                  <div className="skeleton-table-cell-text" />
                )}
              </div>
            </td>
          ))}
          {showActions && (
            <td className="skeleton-table-cell w-16">
              <div className="skeleton-table-cell-actions">
                <div className="skeleton-table-action-menu" />
              </div>
            </td>
          )}
        </tr>
      ))}
    </tbody>
  );

  const renderCompactRows = () => (
    <tbody className="skeleton-table-body skeleton-table-body--compact">
      {Array.from({ length: dimensions.rows }, (_, rowIndex) => (
        <tr
          key={rowIndex}
          className={`skeleton-table-row skeleton-table-row--compact ${striped && rowIndex % 2 === 1 ? 'skeleton-table-row--striped' : ''}`}
          style={{
            animationDelay: animated ? `${(rowIndex + dimensions.cols) * 25}ms` : '0ms'
          }}
        >
          {Array.from({ length: dimensions.cols }, (_, colIndex) => (
            <td
              key={colIndex}
              className={`skeleton-table-cell skeleton-table-cell--compact ${generateColumnWidth(colIndex)}`}
            >
              <div className="skeleton-table-cell-content skeleton-table-cell-content--compact" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );

  const renderDataGridRows = () => (
    <tbody className="skeleton-table-body skeleton-table-body--data-grid">
      {Array.from({ length: dimensions.rows }, (_, rowIndex) => (
        <tr
          key={rowIndex}
          className={`skeleton-table-row skeleton-table-row--data-grid ${striped && rowIndex % 2 === 1 ? 'skeleton-table-row--striped' : ''}`}
          style={{
            animationDelay: animated ? `${(rowIndex + dimensions.cols) * 25}ms` : '0ms'
          }}
        >
          <td className="skeleton-table-cell w-8">
            <div className="skeleton-table-row-number" />
          </td>
          {Array.from({ length: dimensions.cols }, (_, colIndex) => (
            <td
              key={colIndex}
              className={`skeleton-table-cell ${generateColumnWidth(colIndex)}`}
            >
              <div className="skeleton-table-data-cell">
                {colIndex % 3 === 0 ? (
                  <div className="skeleton-table-data-number" />
                ) : colIndex % 3 === 1 ? (
                  <div className="skeleton-table-data-text" />
                ) : (
                  <div className="skeleton-table-data-date" />
                )}
              </div>
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );

  const renderTreeRows = () => (
    <tbody className="skeleton-table-body skeleton-table-body--tree">
      {Array.from({ length: dimensions.rows }, (_, rowIndex) => {
        const indent = Math.floor(rowIndex / 3);

        return (
          <tr
            key={rowIndex}
            className={`skeleton-table-row skeleton-table-row--tree ${striped && rowIndex % 2 === 1 ? 'skeleton-table-row--striped' : ''}`}
            style={{
              animationDelay: animated ? `${(rowIndex + dimensions.cols) * 25}ms` : '0ms'
            }}
          >
            <td className="skeleton-table-cell w-8">
              <div className="skeleton-table-tree-toggle" />
            </td>
            <td className="skeleton-table-cell w-32">
              <div
                className="skeleton-table-tree-content"
                style={{ paddingLeft: `${indent * 20}px` }}
              >
                <div className="skeleton-table-tree-icon" />
                <div className="skeleton-table-tree-label" />
              </div>
            </td>
            {Array.from({ length: dimensions.cols - 2 }, (_, colIndex) => (
              <td
                key={colIndex + 2}
                className={`skeleton-table-cell ${generateColumnWidth(colIndex + 2)}`}
              >
                <div className="skeleton-table-cell-content" />
              </td>
            ))}
          </tr>
        );
      })}
    </tbody>
  );

  const renderTableBody = () => {
    switch (layout) {
      case 'advanced':
        return renderAdvancedRows();
      case 'compact':
        return renderCompactRows();
      case 'data-grid':
        return renderDataGridRows();
      case 'tree':
        return renderTreeRows();
      default:
        return renderBasicRows();
    }
  };

  const renderFilters = () => {
    if (!showFilters) return null;

    return (
      <div className="skeleton-table-filters">
        <div className="skeleton-table-search">
          <div className="skeleton-table-search-input" />
        </div>
        <div className="skeleton-table-filter-group">
          <div className="skeleton-table-filter" />
          <div className="skeleton-table-filter" />
          <div className="skeleton-table-filter" />
        </div>
        <div className="skeleton-table-actions-group">
          <div className="skeleton-table-action-button skeleton-table-action-button--primary" />
          <div className="skeleton-table-action-button" />
        </div>
      </div>
    );
  };

  const renderPagination = () => {
    if (!showPagination) return null;

    return (
      <div className="skeleton-table-pagination">
        <div className="skeleton-table-pagination-info">
          <div className="skeleton-table-pagination-text" />
        </div>
        <div className="skeleton-table-pagination-controls">
          <div className="skeleton-table-pagination-button" />
          <div className="skeleton-table-pagination-pages">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className={`skeleton-table-pagination-page ${index === 2 ? 'skeleton-table-pagination-page--active' : ''}`}
              />
            ))}
          </div>
          <div className="skeleton-table-pagination-button" />
        </div>
      </div>
    );
  };

  const containerClasses = [
    'skeleton-table-container',
    `skeleton-table-container--${variant}`,
    `skeleton-table-container--${size}`,
    `skeleton-table-container--${layout}`,
    animated && pulse ? 'skeleton-table-container--animated' : '',
    componentState.config.animated ? 'skeleton-table-container--transitions' : '',
    bordered ? 'skeleton-table-container--bordered' : '',
    className
  ].filter(Boolean).join(' ');

  const tableClasses = [
    'skeleton-table',
    `skeleton-table--${variant}`,
    `skeleton-table--${size}`,
    `skeleton-table--${layout}`,
    striped ? 'skeleton-table--striped' : '',
    bordered ? 'skeleton-table--bordered' : ''
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
      {renderFilters()}

      <div className="skeleton-table-wrapper">
        <table className={tableClasses}>
          {renderTableHeaders()}
          {renderTableBody()}
        </table>
      </div>

      {renderPagination()}
    </div>
  );
});

SkeletonTable.displayName = 'SkeletonTable';

export default SkeletonTable;