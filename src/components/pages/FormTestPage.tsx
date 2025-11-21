/**
 * Form Component Validation Test Page
 *
 * Comprehensive test page for validating all enhanced form components
 * with comprehensive state management, validation patterns, and visual consistency.
 */

import React, { useState, useRef } from 'react';
import { Input, InputRef, Textarea, TextareaRef, Select, SelectRef, SelectOption, Button, ButtonRef } from '../ui';
import { ComponentStateProvider } from '../../contexts/ComponentStateProvider';
import { User, Mail, MessageCircle, MapPin, Heart, Calendar } from 'lucide-react';

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: 'low', label: '🟢 Low Priority', description: 'Non-urgent tasks' },
  { value: 'medium', label: '🟡 Medium Priority', description: 'Standard priority tasks' },
  { value: 'high', label: '🔴 High Priority', description: 'Urgent tasks' },
  { value: 'critical', label: '🚨 Critical Priority', description: 'Emergency tasks' }
];

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'feature', label: 'Feature Request', icon: <Heart className="w-4 h-4" /> },
  { value: 'bug', label: 'Bug Report', icon: <MessageCircle className="w-4 h-4" /> },
  { value: 'enhancement', label: 'Enhancement', icon: <User className="w-4 h-4" /> },
  { value: 'documentation', label: 'Documentation', icon: <Calendar className="w-4 h-4" /> }
];

export const FormTestPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
    priority: '',
    category: '',
    location: ''
  });

  const [validationResults, setValidationResults] = useState<string[]>([]);
  const [submitResults, setSubmitResults] = useState<string[]>([]);

  // Component refs for imperative testing
  const nameRef = useRef<InputRef>(null);
  const emailRef = useRef<InputRef>(null);
  const messageRef = useRef<TextareaRef>(null);
  const priorityRef = useRef<SelectRef>(null);
  const categoryRef = useRef<SelectRef>(null);
  const submitRef = useRef<ButtonRef>(null);

  // Validation functions
  const validateName = (value: string) => {
    if (value.length < 2) {
      return { isValid: false, error: 'Name must be at least 2 characters' };
    }
    return { isValid: true };
  };

  const validateEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return { isValid: false, error: 'Please enter a valid email address' };
    }
    return { isValid: true };
  };

  const validateMessage = (value: string) => {
    if (value.length < 10) {
      return { isValid: false, error: 'Message must be at least 10 characters' };
    }
    if (value.length > 500) {
      return { isValid: false, error: 'Message must be less than 500 characters' };
    }
    return { isValid: true };
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitResults(prev => [...prev, `${new Date().toLocaleTimeString()}: Form submission started`]);

    // Validate all fields
    const validations = [
      { ref: nameRef, name: 'Name' },
      { ref: emailRef, name: 'Email' },
      { ref: messageRef, name: 'Message' },
      { ref: priorityRef, name: 'Priority' },
      { ref: categoryRef, name: 'Category' }
    ];

    let allValid = true;
    for (const { ref, name } of validations) {
      if (ref.current) {
        const isValid = ref.current.validate();
        if (!isValid) {
          allValid = false;
          setSubmitResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${name} validation failed`]);
        } else {
          setSubmitResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${name} validation passed`]);
        }
      }
    }

    if (!allValid) {
      setSubmitResults(prev => [...prev, `${new Date().toLocaleTimeString()}: Form submission failed - validation errors`]);
      return;
    }

    // Simulate async submission
    if (submitRef.current) {
      await submitRef.current.setLoading?.();
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      setSubmitResults(prev => [...prev, `${new Date().toLocaleTimeString()}: Form submitted successfully`]);

      if (submitRef.current) {
        submitRef.current.setSuccess?.('Form submitted successfully!');
      }

      // Reset form
      setTimeout(() => {
        setFormData({
          name: '',
          email: '',
          message: '',
          priority: '',
          category: '',
          location: ''
        });

        // Reset all component states
        validations.forEach(({ ref }) => {
          ref.current?.reset();
        });

        setSubmitResults(prev => [...prev, `${new Date().toLocaleTimeString()}: Form reset completed`]);
      }, 3000);

    } catch (_error) {
      setSubmitResults(prev => [...prev, `${new Date().toLocaleTimeString()}: Form submission failed`]);
      if (submitRef.current) {
        submitRef.current.setError?.('Submission failed. Please try again.');
      }
    }
  };

  // Test imperative API
  const testImperativeAPI = () => {
    setValidationResults(prev => [...prev, `${new Date().toLocaleTimeString()}: Testing imperative API...`]);

    // Test setting states programmatically
    nameRef.current?.setSuccess('Name validation passed!');
    emailRef.current?.setError('Please check your email format');
    messageRef.current?.setState('loading');

    setTimeout(() => {
      messageRef.current?.setSuccess('Message looks great!');
      setValidationResults(prev => [...prev, `${new Date().toLocaleTimeString()}: Imperative API test completed`]);
    }, 2000);
  };

  // Test validation triggers
  const triggerValidationTest = () => {
    setValidationResults(prev => [...prev, `${new Date().toLocaleTimeString()}: Running validation tests...`]);

    // Test all component validations
    const components = [
      { ref: nameRef, name: 'Name Input' },
      { ref: emailRef, name: 'Email Input' },
      { ref: messageRef, name: 'Message Textarea' },
      { ref: priorityRef, name: 'Priority Select' },
      { ref: categoryRef, name: 'Category Select' }
    ];

    components.forEach(({ ref, name }) => {
      if (ref.current) {
        const isValid = ref.current.validate();
        setValidationResults(prev => [...prev,
          `${new Date().toLocaleTimeString()}: ${name} - ${isValid ? 'Valid' : 'Invalid'}`
        ]);
      }
    });
  };

  return (
    <ComponentStateProvider
      defaults={{ animated: true, animationSpeed: 'normal' }}
      globalAnimations={true}
      performanceMonitoring={true}
    >
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Enhanced Form Components Validation
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Comprehensive test suite for Input, Textarea, and Select components with
              state management, validation, accessibility, and advanced features.
            </p>
          </div>

          {/* Test Results Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="w-3 h-3 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                Validation Results
              </h2>
              <div className="bg-gray-900 text-blue-400 p-4 rounded-lg font-mono text-sm max-h-40 overflow-y-auto">
                {validationResults.length === 0 ? (
                  <div className="text-gray-500">Waiting for validation tests...</div>
                ) : (
                  validationResults.map((result, index) => (
                    <div key={index} className="mb-1">{result}</div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                Submission Results
              </h2>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-40 overflow-y-auto">
                {submitResults.length === 0 ? (
                  <div className="text-gray-500">Waiting for form submissions...</div>
                ) : (
                  submitResults.map((result, index) => (
                    <div key={index} className="mb-1">{result}</div>
                  ))
                )}
              </div>
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
                onClick={triggerValidationTest}
              >
                Test Validations
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setValidationResults([]);
                  setSubmitResults([]);
                }}
              >
                Clear Results
              </Button>
            </div>
          </div>

          {/* Main Form */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-200">
              📝 Enhanced Form Components Demo
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Input Components Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  ref={nameRef}
                  label="Full Name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  onValidate={validateName}
                  icon={<User className="w-4 h-4" />}
                  variant="primary"
                  size="md"
                  required
                  data-testid="form-name-input"
                />

                <Input
                  ref={emailRef}
                  label="Email Address"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  onValidate={validateEmail}
                  icon={<Mail className="w-4 h-4" />}
                  variant="primary"
                  size="md"
                  required
                  data-testid="form-email-input"
                />
              </div>

              {/* Textarea Component */}
              <Textarea
                ref={messageRef}
                label="Message"
                placeholder="Enter your message here..."
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                onValidate={validateMessage}
                variant="primary"
                size="md"
                autoResize={true}
                minRows={4}
                maxRows={8}
                showCharacterCount={true}
                maxLength={500}
                helperText="Describe your request in detail"
                required
                data-testid="form-message-textarea"
              />

              {/* Select Components Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Select
                  ref={priorityRef}
                  label="Priority Level"
                  placeholder="Select priority..."
                  options={PRIORITY_OPTIONS}
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                  variant="primary"
                  size="md"
                  customSelect={true}
                  required
                  data-testid="form-priority-select"
                />

                <Select
                  ref={categoryRef}
                  label="Category"
                  placeholder="Select category..."
                  options={CATEGORY_OPTIONS}
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  variant="primary"
                  size="md"
                  customSelect={true}
                  required
                  data-testid="form-category-select"
                />
              </div>

              {/* Optional Location Input */}
              <Input
                label="Location (Optional)"
                placeholder="Enter your location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                icon={<MapPin className="w-4 h-4" />}
                variant="secondary"
                size="md"
                helperText="This field is optional and demonstrates different variants"
                data-testid="form-location-input"
              />

              {/* Submit Button */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    All required fields must be filled out correctly
                  </div>
                  <Button
                    ref={submitRef}
                    type="submit"
                    variant="primary"
                    size="lg"
                    data-testid="form-submit-button"
                  >
                    Submit Form
                  </Button>
                </div>
              </div>
            </form>
          </div>

          {/* Component Feature Summary */}
          <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-200">
              🚀 Enhanced Features Demonstrated
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">Input Component</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• 6 variants, 6 states, 5 sizes</li>
                  <li>• Real-time validation</li>
                  <li>• Icon support</li>
                  <li>• Imperative API</li>
                  <li>• State management</li>
                </ul>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-2">Textarea Component</h3>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Auto-resize functionality</li>
                  <li>• Character counting</li>
                  <li>• Validation integration</li>
                  <li>• Enhanced accessibility</li>
                  <li>• Animation support</li>
                </ul>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <h3 className="font-semibold text-purple-800 mb-2">Select Component</h3>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• Custom dropdown UI</li>
                  <li>• Icons and descriptions</li>
                  <li>• Searchable options</li>
                  <li>• Multi-select support</li>
                  <li>• Keyboard navigation</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ComponentStateProvider>
  );
};