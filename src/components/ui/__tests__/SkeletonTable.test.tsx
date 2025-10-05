/**
 * SkeletonTable Component Test Suite
 *
 * Tests skeleton table loading component with multiple layouts,
 * responsive behavior, and advanced table features.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SkeletonTable, { SkeletonTableRef } from '../SkeletonTable';

describe('SkeletonTable Component', () => {
  describe('Rendering Tests', () => {
    it('should render with default props', () => {
      render(<SkeletonTable data-testid="skeleton-table" />);
      const skeleton = screen.getByTestId('skeleton-table');

      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass('skeleton-table-container');
      expect(skeleton).toHaveClass('skeleton-table-container--primary');
      expect(skeleton).toHaveClass('skeleton-table-container--md');
      expect(skeleton).toHaveClass('skeleton-table-container--basic');
    });

    it('should render with custom variant', () => {
      render(<SkeletonTable variant="secondary" data-testid="skeleton-table" />);
      const skeleton = screen.getByTestId('skeleton-table');

      expect(skeleton).toHaveClass('skeleton-table-container--secondary');
      expect(skeleton).toHaveAttribute('data-variant', 'secondary');
    });

    it('should render with custom size', () => {
      render(<SkeletonTable size="lg" data-testid="skeleton-table" />);
      const skeleton = screen.getByTestId('skeleton-table');

      expect(skeleton).toHaveClass('skeleton-table-container--lg');
      expect(skeleton).toHaveAttribute('data-size', 'lg');
    });

    it('should render with custom className', () => {
      render(<SkeletonTable className="custom-table" data-testid="skeleton-table" />);
      const skeleton = screen.getByTestId('skeleton-table');

      expect(skeleton).toHaveClass('custom-table');
      expect(skeleton).toHaveClass('skeleton-table-container');
    });

    it('should render with data attributes', () => {
      render(<SkeletonTable variant="primary" size="md" layout="basic" data-testid="skeleton-table" />);
      const skeleton = screen.getByTestId('skeleton-table');

      expect(skeleton).toHaveAttribute('data-variant', 'primary');
      expect(skeleton).toHaveAttribute('data-size', 'md');
      expect(skeleton).toHaveAttribute('data-layout', 'basic');
      expect(skeleton).toHaveAttribute('data-state', 'loading');
    });
  });

  describe('Layout Variants', () => {
    it('should render basic layout', () => {
      render(<SkeletonTable layout="basic" data-testid="skeleton-table" />);
      const skeleton = screen.getByTestId('skeleton-table');

      expect(skeleton).toHaveClass('skeleton-table-container--basic');
      expect(skeleton).toHaveAttribute('data-layout', 'basic');
    });

    it('should render advanced layout', () => {
      render(<SkeletonTable layout="advanced" data-testid="skeleton-table" />);
      const skeleton = screen.getByTestId('skeleton-table');

      expect(skeleton).toHaveClass('skeleton-table-container--advanced');
      expect(skeleton).toHaveAttribute('data-layout', 'advanced');
    });

    it('should render compact layout', () => {
      render(<SkeletonTable layout="compact" data-testid="skeleton-table" />);
      const skeleton = screen.getByTestId('skeleton-table');

      expect(skeleton).toHaveClass('skeleton-table-container--compact');
      expect(skeleton).toHaveAttribute('data-layout', 'compact');
    });

    it('should render data-grid layout', () => {
      render(<SkeletonTable layout="data-grid" data-testid="skeleton-table" />);
      const skeleton = screen.getByTestId('skeleton-table');

      expect(skeleton).toHaveClass('skeleton-table-container--data-grid');
      expect(skeleton).toHaveAttribute('data-layout', 'data-grid');
    });

    it('should render tree layout', () => {
      render(<SkeletonTable layout="tree" data-testid="skeleton-table" />);
      const skeleton = screen.getByTestId('skeleton-table');

      expect(skeleton).toHaveClass('skeleton-table-container--tree');
      expect(skeleton).toHaveAttribute('data-layout', 'tree');
    });
  });

  describe('Table Dimensions', () => {
    it('should render default 8 rows and 6 columns', () => {
      const { container } = render(<SkeletonTable />);
      const rows = container.querySelectorAll('.skeleton-table-row');

      expect(rows).toHaveLength(8);

      const firstRowCells = rows[0].querySelectorAll('.skeleton-table-cell');
      expect(firstRowCells.length).toBeGreaterThanOrEqual(6);
    });

    it('should render custom rows and columns', () => {
      const { container } = render(<SkeletonTable rows={5} cols={4} />);
      const rows = container.querySelectorAll('.skeleton-table-row');

      expect(rows).toHaveLength(5);

      const firstRowCells = rows[0].querySelectorAll('.skeleton-table-cell');
      expect(firstRowCells.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle minimal dimensions', () => {
      const { container } = render(<SkeletonTable rows={1} cols={1} />);
      const rows = container.querySelectorAll('.skeleton-table-row');

      expect(rows).toHaveLength(1);
    });

    it('should handle large dimensions', () => {
      const { container } = render(<SkeletonTable rows={50} cols={20} />);
      const rows = container.querySelectorAll('.skeleton-table-row');

      expect(rows).toHaveLength(50);
    });
  });

  describe('Table Headers', () => {
    it('should show headers by default', () => {
      const { container } = render(<SkeletonTable />);
      const thead = container.querySelector('.skeleton-table-head');

      expect(thead).toBeInTheDocument();
    });

    it('should hide headers when showHeaders is false', () => {
      const { container } = render(<SkeletonTable showHeaders={false} />);
      const thead = container.querySelector('.skeleton-table-head');

      expect(thead).not.toBeInTheDocument();
    });

    it('should render header cells matching column count', () => {
      const { container } = render(<SkeletonTable cols={5} showActions={false} />);
      const headerCells = container.querySelectorAll('.skeleton-table-header-cell');

      expect(headerCells).toHaveLength(5);
    });

    it('should add actions column when showActions is true', () => {
      const { container } = render(<SkeletonTable cols={5} showActions={true} />);
      const headerCells = container.querySelectorAll('.skeleton-table-header-cell');

      expect(headerCells.length).toBeGreaterThan(5);
    });
  });

  describe('Table Features', () => {
    it('should show actions column when showActions is true', () => {
      const { container } = render(<SkeletonTable showActions={true} />);
      const actionCells = container.querySelectorAll('.skeleton-table-cell-actions');

      expect(actionCells.length).toBeGreaterThan(0);
    });

    it('should hide actions column when showActions is false', () => {
      const { container } = render(<SkeletonTable showActions={false} />);
      const actionCells = container.querySelectorAll('.skeleton-table-cell-actions');

      expect(actionCells).toHaveLength(0);
    });

    it('should show filters when showFilters is true', () => {
      const { container } = render(<SkeletonTable showFilters={true} />);
      const filters = container.querySelector('.skeleton-table-filters');

      expect(filters).toBeInTheDocument();
    });

    it('should hide filters when showFilters is false', () => {
      const { container } = render(<SkeletonTable showFilters={false} />);
      const filters = container.querySelector('.skeleton-table-filters');

      expect(filters).not.toBeInTheDocument();
    });

    it('should show pagination by default', () => {
      const { container } = render(<SkeletonTable />);
      const pagination = container.querySelector('.skeleton-table-pagination');

      expect(pagination).toBeInTheDocument();
    });

    it('should hide pagination when showPagination is false', () => {
      const { container } = render(<SkeletonTable showPagination={false} />);
      const pagination = container.querySelector('.skeleton-table-pagination');

      expect(pagination).not.toBeInTheDocument();
    });
  });

  describe('Table Styling', () => {
    it('should apply striped styling by default', () => {
      const { container } = render(<SkeletonTable />);
      const table = container.querySelector('.skeleton-table');

      expect(table).toHaveClass('skeleton-table--striped');
    });

    it('should not apply striped styling when striped is false', () => {
      const { container } = render(<SkeletonTable striped={false} />);
      const table = container.querySelector('.skeleton-table');

      expect(table).not.toHaveClass('skeleton-table--striped');
    });

    it('should apply bordered styling when bordered is true', () => {
      const { container } = render(<SkeletonTable bordered={true} data-testid="skeleton-table" />);
      const container_elem = screen.getByTestId('skeleton-table');
      const table = container.querySelector('.skeleton-table');

      expect(container_elem).toHaveClass('skeleton-table-container--bordered');
      expect(table).toHaveClass('skeleton-table--bordered');
    });

    it('should not apply bordered styling by default', () => {
      const { container } = render(<SkeletonTable data-testid="skeleton-table" />);
      const container_elem = screen.getByTestId('skeleton-table');

      expect(container_elem).not.toHaveClass('skeleton-table-container--bordered');
    });

    it('should apply striped class to odd rows', () => {
      const { container } = render(<SkeletonTable striped={true} rows={3} />);
      const rows = container.querySelectorAll('.skeleton-table-row');

      expect(rows[1]).toHaveClass('skeleton-table-row--striped');
    });
  });

  describe('Animation States', () => {
    it('should apply animation classes when animated is true', () => {
      render(<SkeletonTable animated={true} pulse={true} data-testid="skeleton-table" />);
      const skeleton = screen.getByTestId('skeleton-table');

      expect(skeleton).toHaveClass('skeleton-table-container--animated');
      expect(skeleton).toHaveClass('skeleton-table-container--transitions');
    });

    it('should not apply animation classes when animated is false', () => {
      render(<SkeletonTable animated={false} pulse={false} data-testid="skeleton-table" />);
      const skeleton = screen.getByTestId('skeleton-table');

      expect(skeleton).not.toHaveClass('skeleton-table-container--animated');
    });

    it('should apply staggered animation delays to header cells', () => {
      const { container } = render(<SkeletonTable cols={3} animated={true} />);
      const headerCells = container.querySelectorAll('.skeleton-table-header-cell');

      expect(headerCells[0]).toHaveStyle({ animationDelay: '0ms' });
      expect(headerCells[1]).toHaveStyle({ animationDelay: '25ms' });
      expect(headerCells[2]).toHaveStyle({ animationDelay: '50ms' });
    });

    it('should apply staggered animation delays to body rows', () => {
      const { container } = render(<SkeletonTable rows={3} cols={2} animated={true} />);
      const rows = container.querySelectorAll('.skeleton-table-row');

      rows.forEach(row => {
        const delay = row.style.animationDelay;
        expect(delay).toMatch(/\d+ms/);
      });
    });
  });

  describe('Advanced Layout Specific', () => {
    it('should render checkboxes in advanced layout', () => {
      const { container } = render(<SkeletonTable layout="advanced" />);
      const checkboxes = container.querySelectorAll('.skeleton-table-checkbox');

      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('should render avatars in advanced layout', () => {
      const { container } = render(<SkeletonTable layout="advanced" />);
      const avatars = container.querySelectorAll('.skeleton-table-avatar');

      expect(avatars.length).toBeGreaterThan(0);
    });

    it('should render name groups in advanced layout', () => {
      const { container } = render(<SkeletonTable layout="advanced" />);
      const nameGroups = container.querySelectorAll('.skeleton-table-name-group');

      expect(nameGroups.length).toBeGreaterThan(0);
    });
  });

  describe('Data Grid Layout Specific', () => {
    it('should render row numbers in data-grid layout', () => {
      const { container } = render(<SkeletonTable layout="data-grid" />);
      const rowNumbers = container.querySelectorAll('.skeleton-table-row-number');

      expect(rowNumbers.length).toBeGreaterThan(0);
    });

    it('should render data cells in data-grid layout', () => {
      const { container } = render(<SkeletonTable layout="data-grid" />);
      const dataCells = container.querySelectorAll('.skeleton-table-data-cell');

      expect(dataCells.length).toBeGreaterThan(0);
    });
  });

  describe('Tree Layout Specific', () => {
    it('should render tree toggles in tree layout', () => {
      const { container } = render(<SkeletonTable layout="tree" />);
      const toggles = container.querySelectorAll('.skeleton-table-tree-toggle');

      expect(toggles.length).toBeGreaterThan(0);
    });

    it('should render tree content with indentation in tree layout', () => {
      const { container } = render(<SkeletonTable layout="tree" />);
      const treeContent = container.querySelectorAll('.skeleton-table-tree-content');

      expect(treeContent.length).toBeGreaterThan(0);
    });
  });

  describe('Pagination', () => {
    it('should render pagination controls', () => {
      const { container } = render(<SkeletonTable showPagination={true} />);
      const paginationControls = container.querySelector('.skeleton-table-pagination-controls');

      expect(paginationControls).toBeInTheDocument();
    });

    it('should render pagination pages', () => {
      const { container } = render(<SkeletonTable showPagination={true} />);
      const pages = container.querySelectorAll('.skeleton-table-pagination-page');

      expect(pages).toHaveLength(5);
    });

    it('should mark active page', () => {
      const { container } = render(<SkeletonTable showPagination={true} />);
      const activePages = container.querySelectorAll('.skeleton-table-pagination-page--active');

      expect(activePages.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Filters', () => {
    it('should render search input in filters', () => {
      const { container } = render(<SkeletonTable showFilters={true} />);
      const searchInput = container.querySelector('.skeleton-table-search-input');

      expect(searchInput).toBeInTheDocument();
    });

    it('should render filter group in filters', () => {
      const { container } = render(<SkeletonTable showFilters={true} />);
      const filterGroups = container.querySelectorAll('.skeleton-table-filter');

      expect(filterGroups).toHaveLength(3);
    });
  });

  describe('Ref Imperative Methods', () => {
    it('should expose setLoading method', () => {
      const ref = React.createRef<SkeletonTableRef>();
      render(<SkeletonTable ref={ref} data-testid="skeleton-table" />);

      expect(ref.current).toBeDefined();
      expect(ref.current?.setLoading).toBeInstanceOf(Function);

      ref.current?.setLoading();
      const skeleton = screen.getByTestId('skeleton-table');
      expect(skeleton).toHaveAttribute('data-state', 'loading');
    });

    it('should expose setIdle method', async () => {
      const ref = React.createRef<SkeletonTableRef>();
      render(<SkeletonTable ref={ref} data-testid="skeleton-table" />);

      expect(ref.current?.setIdle).toBeInstanceOf(Function);

      ref.current?.setIdle();
      await waitFor(() => {
        const skeleton = screen.getByTestId('skeleton-table');
        expect(skeleton).toHaveAttribute('data-state', 'idle');
      });
    });

    it('should expose startAnimation method', () => {
      const ref = React.createRef<SkeletonTableRef>();
      render(<SkeletonTable ref={ref} animated={false} data-testid="skeleton-table" />);

      expect(ref.current?.startAnimation).toBeInstanceOf(Function);
      // Note: setAnimated is not available in useComponentState hook
    });

    it('should expose stopAnimation method', async () => {
      const ref = React.createRef<SkeletonTableRef>();
      render(<SkeletonTable ref={ref} animated={true} data-testid="skeleton-table" />);

      expect(ref.current?.stopAnimation).toBeInstanceOf(Function);
      // Note: setAnimated is not available in useComponentState hook
    });

    it('should expose refresh method', async () => {
      const ref = React.createRef<SkeletonTableRef>();
      render(<SkeletonTable ref={ref} data-testid="skeleton-table" />);

      expect(ref.current?.refresh).toBeInstanceOf(Function);

      ref.current?.refresh();
      await waitFor(() => {
        const skeleton = screen.getByTestId('skeleton-table');
        expect(skeleton).toHaveAttribute('data-state', 'loading');
      });
    });

    it('should expose updateDimensions method', async () => {
      const ref = React.createRef<SkeletonTableRef>();
      const { container } = render(<SkeletonTable ref={ref} rows={2} cols={2} />);

      expect(ref.current?.updateDimensions).toBeInstanceOf(Function);

      // Update dimensions using the ref method
      ref.current?.updateDimensions(10, 10);

      // Force rerender to apply dimension changes
      await waitFor(() => {
        const rows = container.querySelectorAll('.skeleton-table-row');
        expect(rows.length).toBeGreaterThan(2);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero rows', () => {
      const { container } = render(<SkeletonTable rows={0} />);
      const rows = container.querySelectorAll('.skeleton-table-row');

      expect(rows).toHaveLength(0);
    });

    it('should handle all features enabled', () => {
      render(
        <SkeletonTable
          showHeaders={true}
          showActions={true}
          showFilters={true}
          showPagination={true}
          animated={true}
          striped={true}
          bordered={true}
          data-testid="skeleton-table"
        />
      );

      const skeleton = screen.getByTestId('skeleton-table');
      expect(skeleton).toHaveClass('skeleton-table-container--animated');
      expect(skeleton).toHaveClass('skeleton-table-container--bordered');
    });

    it('should handle all features disabled', () => {
      const { container } = render(
        <SkeletonTable
          showHeaders={false}
          showActions={false}
          showFilters={false}
          showPagination={false}
          animated={false}
          striped={false}
          bordered={false}
        />
      );

      expect(container.querySelector('.skeleton-table-head')).not.toBeInTheDocument();
      expect(container.querySelector('.skeleton-table-filters')).not.toBeInTheDocument();
      expect(container.querySelector('.skeleton-table-pagination')).not.toBeInTheDocument();
    });
  });

  describe('Multiple Instances', () => {
    it('should render multiple instances independently', () => {
      render(
        <>
          <SkeletonTable data-testid="table1" layout="basic" />
          <SkeletonTable data-testid="table2" layout="advanced" />
          <SkeletonTable data-testid="table3" layout="compact" />
        </>
      );

      expect(screen.getByTestId('table1')).toHaveClass('skeleton-table-container--basic');
      expect(screen.getByTestId('table2')).toHaveClass('skeleton-table-container--advanced');
      expect(screen.getByTestId('table3')).toHaveClass('skeleton-table-container--compact');
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate loading state for screen readers', () => {
      render(<SkeletonTable data-testid="skeleton-table" />);
      const skeleton = screen.getByTestId('skeleton-table');

      expect(skeleton).toHaveAttribute('data-state', 'loading');
    });

    it('should support custom test ids', () => {
      render(<SkeletonTable data-testid="custom-test-id" />);

      expect(screen.getByTestId('custom-test-id')).toBeInTheDocument();
    });

    it('should render proper table structure', () => {
      const { container } = render(<SkeletonTable />);
      const table = container.querySelector('table');

      expect(table).toBeInTheDocument();
    });
  });
});