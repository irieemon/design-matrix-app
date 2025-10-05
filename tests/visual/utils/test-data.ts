/**
 * Test Data and Fixtures for Visual Authentication Tests
 *
 * Centralized test data, user credentials, and form inputs
 * for consistent testing across scenarios
 */

export interface TestUser {
  email: string;
  password: string;
  fullName?: string;
  expectedRole?: 'user' | 'admin' | 'super_admin';
  isDemo?: boolean;
}

export interface AuthTestScenario {
  name: string;
  description: string;
  user?: TestUser;
  expectedFlow: string[];
  skipInCI?: boolean;
}

// Test users for authentication flows
export const testUsers: Record<string, TestUser> = {
  validUser: {
    email: 'testuser@example.com',
    password: 'TestPassword123!',
    fullName: 'Test User',
    expectedRole: 'user'
  },

  adminUser: {
    email: 'admin@prioritas.com',
    password: 'AdminPassword123!',
    fullName: 'Admin User',
    expectedRole: 'super_admin'
  },

  demoUser: {
    email: 'demo@example.com',
    password: 'demo123',
    fullName: 'Demo User',
    expectedRole: 'user',
    isDemo: true
  },

  invalidUser: {
    email: 'invalid@example.com',
    password: 'wrongpassword',
    fullName: 'Invalid User'
  }
};

// Form validation test data
export const validationTestData = {
  email: {
    valid: [
      'test@example.com',
      'user.name+tag@domain.co.uk',
      'valid.email@subdomain.domain.com'
    ],
    invalid: [
      'invalid-email',
      '@domain.com',
      'user@',
      'spaces @domain.com',
      'user@@domain.com'
    ]
  },

  password: {
    valid: [
      'ValidPass123!',
      'AnotherGood1!',
      'ComplexPassword@2024'
    ],
    invalid: [
      'short',       // Too short
      'nouppercase', // No uppercase
      'NOLOWERCASE', // No lowercase
      'NoNumbers!',  // No numbers
      'NoSpecial123' // No special characters
    ]
  },

  fullName: {
    valid: [
      'John Doe',
      'Maria Garcia-Rodriguez',
      '李小明',
      'François Müller'
    ],
    invalid: [
      '',           // Empty
      'A',          // Too short
      '123',        // Numbers only
      '@#$%'        // Special chars only
    ]
  }
};

// Test scenarios for comprehensive auth flow testing
export const authTestScenarios: AuthTestScenario[] = [
  {
    name: 'complete-login-flow',
    description: 'Full login process from landing to authenticated state',
    user: testUsers.validUser,
    expectedFlow: [
      'loading-screen',
      'auth-screen-login',
      'form-filled',
      'form-submitting',
      'login-success',
      'authenticated-app'
    ]
  },

  {
    name: 'complete-signup-flow',
    description: 'Full signup process with email confirmation',
    user: testUsers.validUser,
    expectedFlow: [
      'loading-screen',
      'auth-screen-login',
      'auth-screen-signup',
      'signup-form-filled',
      'form-submitting',
      'signup-success',
      'email-confirmation-message'
    ]
  },

  {
    name: 'forgot-password-flow',
    description: 'Password reset request flow',
    user: testUsers.validUser,
    expectedFlow: [
      'auth-screen-login',
      'auth-screen-forgot-password',
      'reset-form-filled',
      'form-submitting',
      'reset-success'
    ]
  },

  {
    name: 'authentication-errors',
    description: 'Various authentication error states',
    user: testUsers.invalidUser,
    expectedFlow: [
      'auth-screen-login',
      'form-filled',
      'form-submitting',
      'login-error',
      'error-message-displayed'
    ]
  },

  {
    name: 'refresh-with-session',
    description: 'Page refresh with active authentication session',
    user: testUsers.validUser,
    expectedFlow: [
      'fast-path-loading',
      'session-restoration',
      'authenticated-app'
    ]
  },

  {
    name: 'demo-user-flow',
    description: 'Demo user authentication and fallback handling',
    user: testUsers.demoUser,
    expectedFlow: [
      'loading-screen',
      'demo-auth-bypass',
      'authenticated-app'
    ]
  }
];

// Visual viewport configurations for responsive testing
export const viewportConfigurations = [
  {
    name: 'desktop',
    width: 1280,
    height: 720,
    description: 'Standard desktop viewport'
  },
  {
    name: 'laptop',
    width: 1024,
    height: 768,
    description: 'Small laptop viewport'
  },
  {
    name: 'tablet',
    width: 768,
    height: 1024,
    description: 'Tablet portrait mode'
  },
  {
    name: 'tablet-landscape',
    width: 1024,
    height: 768,
    description: 'Tablet landscape mode'
  },
  {
    name: 'mobile',
    width: 375,
    height: 667,
    description: 'Mobile portrait mode'
  },
  {
    name: 'mobile-large',
    width: 414,
    height: 896,
    description: 'Large mobile viewport'
  }
];

// Form interaction patterns for testing
export const formInteractionPatterns = [
  {
    name: 'tab-navigation',
    description: 'Navigate through form using Tab key',
    actions: ['tab', 'tab', 'tab', 'shift+tab']
  },
  {
    name: 'click-focus',
    description: 'Click to focus each field individually',
    actions: ['click-email', 'click-password', 'click-submit']
  },
  {
    name: 'rapid-typing',
    description: 'Fast typing to test input handling',
    actions: ['fast-type-email', 'fast-type-password']
  },
  {
    name: 'copy-paste',
    description: 'Copy-paste operations in form fields',
    actions: ['paste-email', 'paste-password']
  }
];

// Performance benchmarks for auth operations
export const performanceBenchmarks = {
  initialLoad: {
    target: 3000, // 3s max for initial page load
    warning: 2000 // Warn at 2s
  },
  authFormRender: {
    target: 500,  // 500ms max for auth form to render
    warning: 300
  },
  formSubmission: {
    target: 2000, // 2s max for form submission
    warning: 1500
  },
  sessionRestore: {
    target: 1000, // 1s max for session restoration
    warning: 500
  },
  modeTransition: {
    target: 300,  // 300ms max for login/signup mode switch
    warning: 200
  }
};

// Error scenarios for testing error handling
export const errorScenarios = [
  {
    name: 'network-error',
    description: 'Network failure during authentication',
    mockError: 'NetworkError: Failed to fetch'
  },
  {
    name: 'server-error',
    description: 'Server returns 500 error',
    mockError: 'Server Error: Internal Server Error'
  },
  {
    name: 'timeout-error',
    description: 'Request timeout during login',
    mockError: 'TimeoutError: Request timeout'
  },
  {
    name: 'invalid-credentials',
    description: 'Invalid email/password combination',
    mockError: 'Invalid login credentials'
  },
  {
    name: 'account-locked',
    description: 'Account temporarily locked',
    mockError: 'Account temporarily locked. Please try again later.'
  }
];

// Loading state configurations
export const loadingStateConfigs = [
  {
    name: 'skeleton-loading',
    duration: 1000,
    description: 'Initial skeleton loading screen'
  },
  {
    name: 'form-submission',
    duration: 2000,
    description: 'Form submission loading state'
  },
  {
    name: 'session-restore',
    duration: 500,
    description: 'Session restoration loading'
  },
  {
    name: 'timeout-recovery',
    duration: 10000,
    description: 'Loading timeout and recovery screen'
  }
];

export default {
  testUsers,
  validationTestData,
  authTestScenarios,
  viewportConfigurations,
  formInteractionPatterns,
  performanceBenchmarks,
  errorScenarios,
  loadingStateConfigs
};