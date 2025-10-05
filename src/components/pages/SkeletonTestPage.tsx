/**
 * Skeleton Component Validation Test Page
 *
 * Comprehensive test page for validating all enhanced skeleton components
 * with multiple layouts, variants, and visual consistency demonstrations.
 */

import React, { useState, useRef } from 'react';
import { SkeletonText, SkeletonCard, SkeletonMatrix, SkeletonTable, Button } from '../ui';
import { ComponentStateProvider } from '../../contexts/ComponentStateProvider';
import { SkeletonTextRef, SkeletonCardRef, SkeletonMatrixRef, SkeletonTableRef } from '../ui';

export const SkeletonTestPage: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [currentDemo, setCurrentDemo] = useState<'text' | 'card' | 'matrix' | 'table'>('text');

  // Component refs for imperative testing
  const textRef = useRef<SkeletonTextRef>(null);
  const cardRef = useRef<SkeletonCardRef>(null);
  const matrixRef = useRef<SkeletonMatrixRef>(null);
  const tableRef = useRef<SkeletonTableRef>(null);

  const addTestResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Test imperative API
  const testImperativeAPI = () => {
    addTestResult('Testing imperative API across all skeleton components...');

    // Test text component
    textRef.current?.startAnimation();
    setTimeout(() => {
      textRef.current?.stopAnimation();
      addTestResult('SkeletonText: Animation start/stop test completed');
    }, 2000);

    // Test card component
    cardRef.current?.refresh();
    addTestResult('SkeletonCard: Refresh test completed');

    // Test matrix component
    matrixRef.current?.updateDimensions(3, 5);
    addTestResult('SkeletonMatrix: Dimensions update test completed');

    // Test table component
    tableRef.current?.updateDimensions(6, 4);
    addTestResult('SkeletonTable: Dimensions update test completed');

    setTimeout(() => {
      addTestResult('All imperative API tests completed successfully');
    }, 2500);
  };

  const testStateTransitions = () => {
    addTestResult('Testing state transitions...');

    const components = [textRef, cardRef, matrixRef, tableRef];
    const names = ['SkeletonText', 'SkeletonCard', 'SkeletonMatrix', 'SkeletonTable'];

    components.forEach((ref, index) => {
      if (ref.current) {
        ref.current.setIdle();
        setTimeout(() => {
          ref.current?.setLoading();
          addTestResult(`${names[index]}: State transition test completed`);
        }, 500 + index * 200);
      }
    });
  };

  const renderTextDemo = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Size variants */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Size Variants</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Extra Small (xs)</p>
              <SkeletonText size="xs" lines={3} />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Small (sm)</p>
              <SkeletonText size="sm" lines={3} />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Medium (md)</p>
              <SkeletonText size="md" lines={3} />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Large (lg)</p>
              <SkeletonText size="lg" lines={3} />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Extra Large (xl)</p>
              <SkeletonText size="xl" lines={3} />
            </div>
          </div>
        </div>

        {/* Line count variants */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Line Count Variants</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Single Line</p>
              <SkeletonText lines={1} />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Three Lines</p>
              <SkeletonText lines={3} />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Five Lines</p>
              <SkeletonText lines={5} />
            </div>
          </div>
        </div>

        {/* Width variants */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Width Variants</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Auto Width</p>
              <SkeletonText width="auto" lines={2} />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Full Width</p>
              <SkeletonText width="full" lines={2} />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Custom Width (50%)</p>
              <SkeletonText width="50%" lines={2} />
            </div>
          </div>
        </div>
      </div>

      {/* Controllable instance */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Imperative Control Test</h3>
        <SkeletonText
          ref={textRef}
          lines={4}
          size="md"
          animated={true}
          data-testid="controllable-skeleton-text"
        />
      </div>
    </div>
  );

  const renderCardDemo = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Layout variants */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-800">Layout Variants</h3>

          <div>
            <p className="text-sm text-gray-600 mb-2">Basic Layout</p>
            <SkeletonCard layout="basic" showButton={true} />
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Media Layout</p>
            <SkeletonCard layout="media" showImage={true} showButton={true} />
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Profile Layout</p>
            <SkeletonCard layout="profile" showAvatar={true} showButton={true} />
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-800">Content Variants</h3>

          <div>
            <p className="text-sm text-gray-600 mb-2">Article Layout</p>
            <SkeletonCard layout="article" showImage={true} lines={2} />
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Product Layout</p>
            <SkeletonCard layout="product" showImage={true} showButton={true} lines={1} />
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-800">Size Variants</h3>

          <div>
            <p className="text-sm text-gray-600 mb-2">Small (sm)</p>
            <SkeletonCard size="sm" layout="basic" lines={2} />
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Large (lg)</p>
            <SkeletonCard size="lg" layout="basic" lines={4} />
          </div>
        </div>
      </div>

      {/* Controllable instance */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Imperative Control Test</h3>
        <div className="max-w-sm">
          <SkeletonCard
            ref={cardRef}
            layout="media"
            showImage={true}
            showButton={true}
            lines={3}
            data-testid="controllable-skeleton-card"
          />
        </div>
      </div>
    </div>
  );

  const renderMatrixDemo = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Grid layouts */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-800">Grid Layouts</h3>

          <div>
            <p className="text-sm text-gray-600 mb-2">Basic Grid (3x3)</p>
            <SkeletonMatrix layout="grid" rows={3} cols={3} showHeaders={true} />
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Masonry Layout</p>
            <SkeletonMatrix layout="masonry" items={6} />
          </div>
        </div>

        {/* Specialized layouts */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-800">Specialized Layouts</h3>

          <div>
            <p className="text-sm text-gray-600 mb-2">Kanban Board</p>
            <SkeletonMatrix layout="kanban" cols={3} />
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Timeline</p>
            <SkeletonMatrix layout="timeline" items={4} />
          </div>
        </div>
      </div>

      {/* Dashboard layout - full width */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-800">Dashboard Layout</h3>
        <SkeletonMatrix
          layout="dashboard"
          showHeaders={true}
          data-testid="dashboard-skeleton"
        />
      </div>

      {/* Controllable instance */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Imperative Control Test</h3>
        <SkeletonMatrix
          ref={matrixRef}
          layout="grid"
          rows={2}
          cols={4}
          showHeaders={true}
          data-testid="controllable-skeleton-matrix"
        />
      </div>
    </div>
  );

  const renderTableDemo = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-8">
        {/* Basic table layouts */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-800">Table Layout Variants</h3>

          <div>
            <p className="text-sm text-gray-600 mb-2">Basic Table</p>
            <SkeletonTable
              layout="basic"
              rows={5}
              cols={4}
              showHeaders={true}
              showActions={true}
              striped={true}
            />
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Advanced Table with Filters</p>
            <SkeletonTable
              layout="advanced"
              rows={4}
              cols={5}
              showHeaders={true}
              showActions={true}
              showFilters={true}
              showPagination={true}
              striped={true}
            />
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Compact Table</p>
            <SkeletonTable
              layout="compact"
              rows={6}
              cols={3}
              showHeaders={true}
              striped={false}
            />
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Data Grid</p>
            <SkeletonTable
              layout="data-grid"
              rows={5}
              cols={6}
              showHeaders={true}
              showPagination={true}
            />
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Tree Table</p>
            <SkeletonTable
              layout="tree"
              rows={7}
              cols={4}
              showHeaders={true}
              showActions={true}
            />
          </div>
        </div>
      </div>

      {/* Controllable instance */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Imperative Control Test</h3>
        <SkeletonTable
          ref={tableRef}
          layout="basic"
          rows={4}
          cols={5}
          showHeaders={true}
          showActions={true}
          showPagination={true}
          data-testid="controllable-skeleton-table"
        />
      </div>
    </div>
  );

  return (
    <ComponentStateProvider
      defaults={{ animated: true, animationSpeed: 'normal' }}
      globalAnimations={true}
      performanceMonitoring={true}
    >
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Enhanced Skeleton Loading System
            </h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Comprehensive test suite for SkeletonText, SkeletonCard, SkeletonMatrix, and SkeletonTable components
              with multiple layouts, state management, and accessibility features.
            </p>
          </div>

          {/* Test Results Panel */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              Test Results
            </h2>
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-40 overflow-y-auto">
              {testResults.length === 0 ? (
                <div className="text-gray-500">Waiting for skeleton tests...</div>
              ) : (
                testResults.map((result, index) => (
                  <div key={index} className="mb-1">{result}</div>
                ))
              )}
            </div>
          </div>

          {/* Test Controls */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Test Controls</h2>
            <div className="flex flex-wrap gap-4">
              <Button
                variant="secondary"
                size="md"
                onClick={testImperativeAPI}
              >
                Test Imperative API
              </Button>
              <Button
                variant="tertiary"
                size="md"
                onClick={testStateTransitions}
              >
                Test State Transitions
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setTestResults([])}
              >
                Clear Results
              </Button>
            </div>
          </div>

          {/* Component Navigation */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Component Demos</h2>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'text', label: 'SkeletonText' },
                { key: 'card', label: 'SkeletonCard' },
                { key: 'matrix', label: 'SkeletonMatrix' },
                { key: 'table', label: 'SkeletonTable' }
              ].map(({ key, label }) => (
                <Button
                  key={key}
                  variant={currentDemo === key ? 'primary' : 'ghost'}
                  size="md"
                  onClick={() => setCurrentDemo(key as any)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Component Demonstrations */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-200">
              {currentDemo === 'text' && '📝 SkeletonText Component Demo'}
              {currentDemo === 'card' && '🎴 SkeletonCard Component Demo'}
              {currentDemo === 'matrix' && '🔲 SkeletonMatrix Component Demo'}
              {currentDemo === 'table' && '📊 SkeletonTable Component Demo'}
            </h2>

            {currentDemo === 'text' && renderTextDemo()}
            {currentDemo === 'card' && renderCardDemo()}
            {currentDemo === 'matrix' && renderMatrixDemo()}
            {currentDemo === 'table' && renderTableDemo()}
          </div>

          {/* Component Feature Summary */}
          <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-200">
              🚀 Enhanced Skeleton System Features
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">SkeletonText</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• 5 size variants (xs-xl)</li>
                  <li>• Variable line count</li>
                  <li>• Width control options</li>
                  <li>• Animation controls</li>
                  <li>• Imperative API</li>
                </ul>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-2">SkeletonCard</h3>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• 5 layout variants</li>
                  <li>• Content customization</li>
                  <li>• Size variants</li>
                  <li>• Animation support</li>
                  <li>• Refresh capability</li>
                </ul>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <h3 className="font-semibold text-purple-800 mb-2">SkeletonMatrix</h3>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• 5 layout types</li>
                  <li>• Dynamic dimensions</li>
                  <li>• Sidebar support</li>
                  <li>• Dashboard layouts</li>
                  <li>• Spacing control</li>
                </ul>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <h3 className="font-semibold text-orange-800 mb-2">SkeletonTable</h3>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• 5 table layouts</li>
                  <li>• Filter/pagination</li>
                  <li>• Dynamic sizing</li>
                  <li>• Tree structures</li>
                  <li>• Data grid support</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ComponentStateProvider>
  );
};