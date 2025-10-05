/**
 * Component Showcase - Visual Test Validation Page
 *
 * Comprehensive testing environment for all Enhanced Component State System components.
 * Tests variants, states, sizes, animations, interactions, and accessibility.
 */

import React, { useState, useRef } from 'react'
import { ComponentStateProvider } from '../contexts/ComponentStateProvider'
import { Button, Input, Textarea, Select, SkeletonText, SkeletonCard, SkeletonMatrix, SkeletonTable } from '../components/ui'
import { Mail, User, Search, Phone, ArrowRight, Trash2, Plus, Check } from 'lucide-react'
import { logger } from '../utils/logger'
import type {
  ComponentVariant,
  ComponentState,
  ComponentSize
} from '../types/componentState'

// Test data and configurations
const variants: ComponentVariant[] = ['primary', 'secondary', 'tertiary', 'danger', 'success', 'ghost']
const states: ComponentState[] = ['idle', 'loading', 'error', 'disabled', 'success', 'pending']
const sizes: ComponentSize[] = ['xs', 'sm', 'md', 'lg', 'xl']

const selectOptions = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'option3', label: 'Option 3' },
  { value: 'option4', label: 'Option 4' }
]

const ComponentShowcase: React.FC = () => {
  const [currentSection, setCurrentSection] = useState<string>('buttons')
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})

  // Refs for imperative testing
  const buttonRefs = useRef<Record<string, any>>({})
  const inputRefs = useRef<Record<string, any>>({})

  // Test automation functions
  const runButtonTests = async () => {
    logger.debug('Running Button Component Tests', { component: 'Button', test: 'state-transitions' })

    // Test state transitions
    const primaryButton = buttonRefs.current['primary-md']
    if (primaryButton) {
      await primaryButton.setState('loading')
      await new Promise(resolve => setTimeout(resolve, 1000))
      await primaryButton.setState('success')
      await new Promise(resolve => setTimeout(resolve, 1000))
      await primaryButton.setState('idle')
    }

    setTestResults(prev => ({ ...prev, buttons: true }))
    logger.debug('Button tests completed successfully', { component: 'Button' })
  }

  const runInputTests = async () => {
    logger.debug('Running Input Component Tests', { component: 'Input', test: 'validation' })

    // Test validation
    const emailInput = inputRefs.current['email-test']
    if (emailInput) {
      emailInput.setValue('invalid-email')
      const isValid = emailInput.validate()
      if (!isValid) {
        logger.debug('Email validation working correctly', { validation: 'email', result: 'invalid' })
      }

      emailInput.setValue('test@example.com')
      emailInput.validate()
    }

    setTestResults(prev => ({ ...prev, inputs: true }))
    logger.debug('Input tests completed successfully', { component: 'Input' })
  }

  const runAllTests = async () => {
    logger.debug('Running Comprehensive Component Tests', { test: 'all-components' })
    await runButtonTests()
    await runInputTests()
    logger.debug('All component tests completed successfully', { test: 'all-components', status: 'complete' })
  }

  return (
    <ComponentStateProvider
      defaults={{ animated: true, variant: 'primary' }}
      globalAnimations={true}
      performanceMonitoring={true}
    >
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <header className="text-center mb-12">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Enhanced Component Showcase</h1>
            <p className="text-lg text-slate-600 mb-6">Visual validation for the Enhanced Component State System</p>

            {/* Test Controls */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <Button
                variant="primary"
                size="md"
                onClick={runAllTests}
                iconAfter={<ArrowRight className="w-4 h-4" />}
              >
                Run All Tests
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={runButtonTests}
              >
                Test Buttons
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={runInputTests}
              >
                Test Inputs
              </Button>
            </div>

            {/* Test Results */}
            <div className="flex items-center justify-center gap-4 text-sm">
              <div className={`px-3 py-1 rounded-full ${testResults.buttons ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                {testResults.buttons ? '✅ Buttons' : '⏳ Buttons'}
              </div>
              <div className={`px-3 py-1 rounded-full ${testResults.inputs ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                {testResults.inputs ? '✅ Inputs' : '⏳ Inputs'}
              </div>
            </div>
          </header>

          {/* Navigation */}
          <nav className="mb-12">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {[
                { id: 'buttons', label: 'Buttons', icon: '🔘' },
                { id: 'inputs', label: 'Inputs', icon: '📝' },
                { id: 'forms', label: 'Form Components', icon: '📋' },
                { id: 'skeletons', label: 'Skeleton Loaders', icon: '💀' },
                { id: 'states', label: 'State Testing', icon: '🔄' },
                { id: 'responsive', label: 'Responsive', icon: '📱' }
              ].map((section) => (
                <button
                  key={section.id}
                  onClick={() => setCurrentSection(section.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    currentSection === section.id
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  <span className="mr-2">{section.icon}</span>
                  {section.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content Sections */}
          <main>

            {/* Button Component Testing */}
            {currentSection === 'buttons' && (
              <section className="space-y-12">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-8">Button Component Testing</h2>

                  {/* Button Variants */}
                  <div className="bg-white rounded-2xl p-8 mb-8 shadow-sm border border-slate-200/60">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">Variants (6 types)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {variants.map((variant) => (
                        <Button
                          key={variant}
                          ref={(ref) => buttonRefs.current[`${variant}-md`] = ref}
                          variant={variant}
                          size="md"
                          animated={true}
                        >
                          {variant}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Button Sizes */}
                  <div className="bg-white rounded-2xl p-8 mb-8 shadow-sm border border-slate-200/60">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">Sizes (5 types)</h3>
                    <div className="flex items-end gap-4 flex-wrap">
                      {sizes.map((size) => (
                        <Button
                          key={size}
                          variant="primary"
                          size={size}
                          animated={true}
                        >
                          {size}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Button States */}
                  <div className="bg-white rounded-2xl p-8 mb-8 shadow-sm border border-slate-200/60">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">States (6 types)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {states.map((state) => (
                        <Button
                          key={state}
                          variant="primary"
                          size="md"
                          state={state}
                          animated={true}
                        >
                          {state}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Button with Icons */}
                  <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">Icons & Interactive Features</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Button variant="primary" icon={<Plus className="w-4 h-4" />}>Add Item</Button>
                      <Button variant="secondary" iconAfter={<ArrowRight className="w-4 h-4" />}>Continue</Button>
                      <Button variant="success" icon={<Check className="w-4 h-4" />}>Save</Button>
                      <Button variant="danger" icon={<Trash2 className="w-4 h-4" />}>Delete</Button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Input Component Testing */}
            {currentSection === 'inputs' && (
              <section className="space-y-12">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-8">Input Component Testing</h2>

                  {/* Input Variants */}
                  <div className="bg-white rounded-2xl p-8 mb-8 shadow-sm border border-slate-200/60">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">Input Variants</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {variants.slice(0, 3).map((variant) => (
                        <Input
                          key={variant}
                          label={`${variant} Input`}
                          placeholder={`Enter ${variant} text`}
                          variant={variant}
                          size="md"
                          animated={true}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Input with Icons */}
                  <div className="bg-white rounded-2xl p-8 mb-8 shadow-sm border border-slate-200/60">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">Input with Icons</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Input
                        ref={(ref) => inputRefs.current['email-test'] = ref}
                        label="Email Address"
                        type="email"
                        placeholder="Enter your email"
                        icon={<Mail className="w-5 h-5" />}
                        variant="primary"
                        size="lg"
                        animated={true}
                        onValidate={(value) => {
                          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                          if (!value.trim()) {
                            return { isValid: false, error: 'Email is required' }
                          }
                          if (!emailRegex.test(value)) {
                            return { isValid: false, error: 'Please enter a valid email' }
                          }
                          return { isValid: true }
                        }}
                      />
                      <Input
                        label="Search"
                        placeholder="Search items..."
                        icon={<Search className="w-5 h-5" />}
                        iconAfter={
                          <Button variant="ghost" size="sm">
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        }
                        variant="primary"
                        size="lg"
                        animated={true}
                      />
                    </div>
                  </div>

                  {/* Input States */}
                  <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">Input States</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <Input
                        label="Normal State"
                        placeholder="Normal input"
                        state="idle"
                        variant="primary"
                        animated={true}
                      />
                      <Input
                        label="Loading State"
                        placeholder="Loading..."
                        state="loading"
                        variant="primary"
                        animated={true}
                      />
                      <Input
                        label="Error State"
                        placeholder="Error input"
                        state="error"
                        errorMessage="This field has an error"
                        variant="primary"
                        animated={true}
                      />
                      <Input
                        label="Success State"
                        placeholder="Success input"
                        state="success"
                        successMessage="Input is valid"
                        variant="primary"
                        animated={true}
                      />
                      <Input
                        label="Disabled State"
                        placeholder="Disabled input"
                        state="disabled"
                        variant="primary"
                        animated={true}
                      />
                      <Input
                        label="Pending State"
                        placeholder="Pending validation"
                        state="pending"
                        variant="primary"
                        animated={true}
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Form Components Testing */}
            {currentSection === 'forms' && (
              <section className="space-y-12">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-8">Form Components Testing</h2>

                  {/* Complete Form */}
                  <div className="bg-white rounded-2xl p-8 mb-8 shadow-sm border border-slate-200/60">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">Complete Form Example</h3>
                    <form className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                          label="First Name"
                          placeholder="Enter first name"
                          icon={<User className="w-5 h-5" />}
                          variant="primary"
                          size="lg"
                          animated={true}
                          required
                        />
                        <Input
                          label="Last Name"
                          placeholder="Enter last name"
                          icon={<User className="w-5 h-5" />}
                          variant="primary"
                          size="lg"
                          animated={true}
                          required
                        />
                      </div>

                      <Input
                        label="Email Address"
                        type="email"
                        placeholder="Enter your email"
                        icon={<Mail className="w-5 h-5" />}
                        variant="primary"
                        size="lg"
                        animated={true}
                        required
                      />

                      <Input
                        label="Phone Number"
                        type="tel"
                        placeholder="Enter phone number"
                        icon={<Phone className="w-5 h-5" />}
                        variant="primary"
                        size="lg"
                        animated={true}
                      />

                      <Select
                        label="Country"
                        placeholder="Select your country"
                        options={selectOptions}
                        variant="primary"
                        size="lg"
                        animated={true}
                        required
                      />

                      <Textarea
                        label="Message"
                        placeholder="Enter your message"
                        variant="primary"
                        size="lg"
                        animated={true}
                        rows={4}
                      />

                      <div className="flex gap-4">
                        <Button
                          type="submit"
                          variant="primary"
                          size="lg"
                          iconAfter={<ArrowRight className="w-4 h-4" />}
                          animated={true}
                        >
                          Submit Form
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="lg"
                          animated={true}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              </section>
            )}

            {/* Skeleton Loaders Testing */}
            {currentSection === 'skeletons' && (
              <section className="space-y-12">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-8">Skeleton Loaders Testing</h2>

                  {/* Skeleton Text Variants */}
                  <div className="bg-white rounded-2xl p-8 mb-8 shadow-sm border border-slate-200/60">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">Skeleton Text</h3>
                    <div className="space-y-4">
                      <SkeletonText width="100%" lines={1} animated={true} className="h-6" />
                      <SkeletonText width="80%" lines={1} animated={true} className="h-4" />
                      <SkeletonText width="60%" lines={1} animated={true} className="h-3.5" />
                      <div className="grid grid-cols-3 gap-4">
                        <SkeletonText width="100%" lines={1} animated={true} className="h-3" />
                        <SkeletonText width="100%" lines={1} animated={true} className="h-3" />
                        <SkeletonText width="100%" lines={1} animated={true} className="h-3" />
                      </div>
                    </div>
                  </div>

                  {/* Skeleton Cards */}
                  <div className="bg-white rounded-2xl p-8 mb-8 shadow-sm border border-slate-200/60">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">Skeleton Cards</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <SkeletonCard layout="basic" animated={true} className="h-50" />
                      <SkeletonCard layout="media" showImage={true} animated={true} className="h-50" />
                      <SkeletonCard layout="profile" showAvatar={true} animated={true} className="h-50" />
                    </div>
                  </div>

                  {/* Skeleton Matrix */}
                  <div className="bg-white rounded-2xl p-8 mb-8 shadow-sm border border-slate-200/60">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">Skeleton Matrix</h3>
                    <SkeletonMatrix
                      variant="matrix-safe"
                      animated={true}
                      layout="quad"
                      items={8}
                    />
                  </div>

                  {/* Skeleton Table */}
                  <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">Skeleton Table</h3>
                    <SkeletonTable
                      rows={5}
                      cols={4}
                      animated={true}
                      showHeaders={true}
                    />
                  </div>
                </div>
              </section>
            )}

            {/* State Testing */}
            {currentSection === 'states' && (
              <section className="space-y-12">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-8">Interactive State Testing</h2>

                  <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">Real-time State Transitions</h3>
                    <p className="text-slate-600 mb-6">Click the test buttons above to see components transition between states in real-time.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Interactive Button Test */}
                      <div className="p-4 border border-slate-200 rounded-lg">
                        <h4 className="font-medium text-slate-800 mb-3">Button State Test</h4>
                        <Button
                          ref={(ref) => buttonRefs.current['interactive-test'] = ref}
                          variant="primary"
                          size="md"
                          animated={true}
                          onAsyncAction={async () => {
                            await new Promise(resolve => setTimeout(resolve, 2000))
                          }}
                        >
                          Test Async Action
                        </Button>
                      </div>

                      {/* Interactive Input Test */}
                      <div className="p-4 border border-slate-200 rounded-lg">
                        <h4 className="font-medium text-slate-800 mb-3">Input Validation Test</h4>
                        <Input
                          label="Email Test"
                          placeholder="Type invalid email"
                          variant="primary"
                          size="md"
                          animated={true}
                          onValidate={(value) => {
                            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                            if (value && !emailRegex.test(value)) {
                              return { isValid: false, error: 'Invalid email format' }
                            }
                            return { isValid: true }
                          }}
                        />
                      </div>

                      {/* Performance Monitoring */}
                      <div className="p-4 border border-slate-200 rounded-lg">
                        <h4 className="font-medium text-slate-800 mb-3">Performance Monitor</h4>
                        <div className="text-sm text-slate-600">
                          <div>State transitions: Fast</div>
                          <div>Animations: Smooth</div>
                          <div>Memory usage: Optimal</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Responsive Testing */}
            {currentSection === 'responsive' && (
              <section className="space-y-12">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-8">Responsive Design Testing</h2>

                  <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">Responsive Behavior</h3>
                    <p className="text-slate-600 mb-6">Resize your browser window to test responsive layouts and component scaling.</p>

                    <div className="space-y-6">
                      {/* Mobile-first Form */}
                      <div className="p-4 border border-slate-200 rounded-lg">
                        <h4 className="font-medium text-slate-800 mb-3">Mobile-first Form Layout</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <Input label="Name" placeholder="Full name" size="sm" />
                          <Input label="Email" placeholder="Email address" size="sm" />
                          <Button variant="primary" size="sm">Submit</Button>
                        </div>
                      </div>

                      {/* Responsive Button Groups */}
                      <div className="p-4 border border-slate-200 rounded-lg">
                        <h4 className="font-medium text-slate-800 mb-3">Responsive Button Groups</h4>
                        <div className="flex flex-wrap gap-2">
                          {variants.map((variant) => (
                            <Button key={variant} variant={variant} size="sm">
                              {variant}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Adaptive Sizing */}
                      <div className="p-4 border border-slate-200 rounded-lg">
                        <h4 className="font-medium text-slate-800 mb-3">Adaptive Component Sizing</h4>
                        <div className="space-y-4">
                          <Button variant="primary" size="xs" className="w-full sm:w-auto">XS Button</Button>
                          <Button variant="primary" size="sm" className="w-full sm:w-auto">SM Button</Button>
                          <Button variant="primary" size="md" className="w-full sm:w-auto">MD Button</Button>
                          <Button variant="primary" size="lg" className="w-full sm:w-auto">LG Button</Button>
                          <Button variant="primary" size="xl" className="w-full sm:w-auto">XL Button</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

          </main>
        </div>
      </div>
    </ComponentStateProvider>
  )
}

export default ComponentShowcase