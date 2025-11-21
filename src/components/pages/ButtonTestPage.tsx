/**
 * Button Component Validation Test Page
 *
 * Comprehensive test page for validating all 6 variants, 6 states, and 5 sizes
 * of the enhanced Button component with real-time state management testing.
 */

import React, { useState, useRef } from 'react';
import { Button, ButtonRef } from '../ui/Button';
import { ComponentStateProvider } from '../../contexts/ComponentStateProvider';

const VARIANTS = ['primary', 'secondary', 'tertiary', 'danger', 'success', 'ghost'] as const;
const STATES = ['idle', 'loading', 'error', 'disabled', 'success', 'pending'] as const;
const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

export const ButtonTestPage: React.FC = () => {
  const [interactiveState, setInteractiveState] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [asyncTestResults, setAsyncTestResults] = useState<string[]>([]);
  const buttonRef = useRef<ButtonRef>(null);

  const triggerAsyncAction = async () => {
    setInteractiveState('loading');
    setAsyncTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: Started async action`]);

    try {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 2000));
      setInteractiveState('success');
      setAsyncTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: Async action completed successfully`]);

      // Auto-reset after 3 seconds
      setTimeout(() => {
        setInteractiveState('idle');
        setAsyncTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: Reset to idle state`]);
      }, 3000);
    } catch (_error) {
      setInteractiveState('error');
      setAsyncTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: Async action failed`]);
    }
  };

  const triggerError = async () => {
    setInteractiveState('loading');
    setAsyncTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: Started error action`]);

    // Simulate async operation that fails
    await new Promise(resolve => setTimeout(resolve, 1500));
    setInteractiveState('error');
    setAsyncTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: Error state triggered`]);

    // Auto-reset after 3 seconds
    setTimeout(() => {
      setInteractiveState('idle');
      setAsyncTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: Reset to idle state`]);
    }, 3000);
  };

  const testImperativeAPI = () => {
    if (buttonRef.current) {
      buttonRef.current.setSuccess('Imperative API Test Passed!');
      setAsyncTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: Imperative API test executed`]);
    }
  };

  return (
    <ComponentStateProvider
      defaults={{ animated: true, animationSpeed: 'normal' }}
      globalAnimations={true}
      performanceMonitoring={true}
    >
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Enhanced Button Component Validation
            </h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Comprehensive test suite for the S-tier SaaS dashboard Button component featuring
              6 variants, 6 states, 5 sizes, and advanced state management.
            </p>
          </div>

          {/* Test Results Panel */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              Live Test Results
            </h2>
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-40 overflow-y-auto">
              {asyncTestResults.length === 0 ? (
                <div className="text-gray-500">Waiting for test interactions...</div>
              ) : (
                asyncTestResults.map((result, index) => (
                  <div key={index} className="mb-1">{result}</div>
                ))
              )}
            </div>
          </div>

          {/* Variants Test Section */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-200">
              🎨 Button Variants (6 Total)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {VARIANTS.map(variant => (
                <div key={variant} className="text-center p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-3">
                    {variant}
                  </h3>
                  <Button
                    variant={variant}
                    size="md"
                    data-testid={`button-variant-${variant}`}
                  >
                    {variant.charAt(0).toUpperCase() + variant.slice(1)} Button
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* States Test Section */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-200">
              ⚡ Button States (6 Total)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {STATES.map(state => (
                <div key={state} className="text-center p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-3 flex items-center justify-center">
                    <span className={`w-2 h-2 rounded-full mr-2 ${
                      state === 'idle' ? 'bg-gray-500' :
                      state === 'loading' ? 'bg-blue-500 animate-pulse' :
                      state === 'error' ? 'bg-red-500' :
                      state === 'success' ? 'bg-green-500' :
                      state === 'disabled' ? 'bg-gray-400' :
                      'bg-yellow-500'
                    }`}></span>
                    {state}
                  </h3>
                  <Button
                    variant="primary"
                    state={state}
                    size="md"
                    loadingText={state === 'loading' ? 'Processing...' : undefined}
                    errorMessage={state === 'error' ? 'Action Failed' : undefined}
                    successMessage={state === 'success' ? 'Success!' : undefined}
                    data-testid={`button-state-${state}`}
                  >
                    {state === 'disabled' ? 'Disabled' : 'Test Button'}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Sizes Test Section */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-200">
              📏 Button Sizes (5 Total)
            </h2>
            <div className="text-center p-6 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-6">
                Size Comparison
              </h3>
              <div className="flex flex-wrap items-center justify-center gap-4">
                {SIZES.map(size => (
                  <Button
                    key={size}
                    variant="primary"
                    size={size}
                    data-testid={`button-size-${size}`}
                  >
                    {size.toUpperCase()} Button
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive State Management Section */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-200">
              🚀 Interactive State Management
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-center p-6 bg-blue-50 rounded-lg">
                <h3 className="text-lg font-medium text-blue-800 mb-4">Success Flow Test</h3>
                <Button
                  variant="primary"
                  size="lg"
                  state={interactiveState === 'success' ? 'success' : interactiveState}
                  loadingText="Processing..."
                  successMessage="Action Completed!"
                  onAsyncAction={triggerAsyncAction}
                  data-testid="button-interactive-success"
                >
                  Trigger Success
                </Button>
                <p className="text-sm text-blue-600 mt-3">
                  Tests: Loading → Success → Auto-reset
                </p>
              </div>

              <div className="text-center p-6 bg-red-50 rounded-lg">
                <h3 className="text-lg font-medium text-red-800 mb-4">Error Flow Test</h3>
                <Button
                  variant="danger"
                  size="lg"
                  state={interactiveState === 'error' ? 'error' : (interactiveState === 'loading' ? 'loading' : 'idle')}
                  loadingText="Processing..."
                  errorMessage="Something went wrong!"
                  onAsyncAction={triggerError}
                  data-testid="button-interactive-error"
                >
                  Trigger Error
                </Button>
                <p className="text-sm text-red-600 mt-3">
                  Tests: Loading → Error → Auto-reset
                </p>
              </div>
            </div>

            <div className="mt-6 text-center p-4 bg-purple-50 rounded-lg">
              <h3 className="text-lg font-medium text-purple-800 mb-4">Imperative API Test</h3>
              <Button
                ref={buttonRef}
                variant="secondary"
                size="md"
                onClick={testImperativeAPI}
                data-testid="button-imperative-api"
              >
                Test Imperative API
              </Button>
              <p className="text-sm text-purple-600 mt-3">
                Tests: ref.current.setSuccess() method
              </p>
            </div>

            <div className="mt-6 text-center">
              <div className="inline-flex items-center px-4 py-2 bg-gray-100 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Current State: </span>
                <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded ${
                  interactiveState === 'idle' ? 'bg-gray-200 text-gray-800' :
                  interactiveState === 'loading' ? 'bg-blue-200 text-blue-800' :
                  interactiveState === 'error' ? 'bg-red-200 text-red-800' :
                  'bg-green-200 text-green-800'
                }`}>
                  {interactiveState.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Accessibility Features Section */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-200">
              ♿ Accessibility Features
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-3">
                  Keyboard Navigation
                </h3>
                <Button
                  variant="primary"
                  size="md"
                  data-testid="button-keyboard-focus"
                >
                  Tab to Focus
                </Button>
                <p className="text-xs text-gray-500 mt-2">Use Tab key to focus</p>
              </div>

              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-3">
                  Screen Reader Support
                </h3>
                <Button
                  variant="secondary"
                  size="md"
                  aria-label="Accessible button with custom label for screen readers"
                  data-testid="button-screen-reader"
                >
                  SR Support
                </Button>
                <p className="text-xs text-gray-500 mt-2">aria-label provided</p>
              </div>

              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-3">
                  Loading State
                </h3>
                <Button
                  variant="primary"
                  state="loading"
                  size="md"
                  loadingText="Loading..."
                  data-testid="button-loading-accessibility"
                >
                  Loading Button
                </Button>
                <p className="text-xs text-gray-500 mt-2">aria-busy="true"</p>
              </div>
            </div>
          </div>

          {/* Performance Metrics Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-200">
              📊 Performance Metrics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">6</div>
                <div className="text-sm text-green-700">Variants</div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">6</div>
                <div className="text-sm text-blue-700">States</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">5</div>
                <div className="text-sm text-purple-700">Sizes</div>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">✓</div>
                <div className="text-sm text-yellow-700">Animations</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ComponentStateProvider>
  );
};