// Sample roadmap data for testing exports
export const sampleMarketingRoadmap = [
  {
    id: 'feature-1',
    title: 'Halloween Campaign Launch',
    description: 'Launch comprehensive Halloween marketing campaign across all channels',
    startMonth: 0,
    duration: 2,
    team: 'creative',
    priority: 'high' as const,
    status: 'in-progress' as const,
    userStories: [
      'As a customer, I want to see Halloween-themed content that excites me',
      'As a marketer, I want to track campaign engagement metrics',
      'As a designer, I want consistent brand guidelines for Halloween content'
    ],
    deliverables: [
      'Halloween creative assets',
      'Social media content calendar',
      'Email campaign templates',
      'Landing page designs'
    ],
    successCriteria: [
      'Increase engagement by 25%',
      'Generate 100+ qualified leads',
      'Achieve 15% conversion rate'
    ],
    risks: [
      'Seasonal timing constraints',
      'Competition from other Halloween campaigns'
    ],
    relatedIdeas: ['Thanksgiving follow-up', 'Holiday season prep'],
    complexity: 'medium'
  },
  {
    id: 'feature-2', 
    title: 'Social Media Amplification',
    description: 'Amplify Halloween campaign through social media channels with influencer partnerships',
    startMonth: 1,
    duration: 1,
    team: 'digital',
    priority: 'high' as const,
    status: 'planned' as const,
    userStories: [
      'As a social media user, I want shareable Halloween content',
      'As an influencer, I want branded content that resonates with my audience'
    ],
    deliverables: [
      'Influencer partnership agreements',
      'Social media posting schedule',
      'Hashtag strategy',
      'User-generated content campaign'
    ],
    successCriteria: [
      'Reach 500K impressions',
      'Generate 1000+ shares',
      '50+ influencer posts'
    ],
    risks: ['Influencer availability', 'Platform algorithm changes'],
    relatedIdeas: ['Year-round influencer program'],
    complexity: 'low'
  },
  {
    id: 'feature-3',
    title: 'Performance Analytics Dashboard',
    description: 'Create comprehensive analytics dashboard to track campaign performance in real-time',
    startMonth: 0,
    duration: 3,
    team: 'analytics', 
    priority: 'medium' as const,
    status: 'planned' as const,
    userStories: [
      'As a campaign manager, I want real-time performance metrics',
      'As a stakeholder, I want clear ROI reporting'
    ],
    deliverables: [
      'Analytics dashboard setup',
      'Custom tracking implementation',
      'Automated reporting system',
      'Performance optimization recommendations'
    ],
    successCriteria: [
      'Real-time data accuracy >95%',
      'Dashboard response time <2 seconds',
      'Weekly automated reports'
    ],
    risks: ['Data integration complexity', 'Third-party API limitations'],
    relatedIdeas: ['Customer journey mapping', 'Predictive analytics'],
    complexity: 'high'
  },
  {
    id: 'feature-4',
    title: 'Operations & Fulfillment',
    description: 'Ensure smooth operations and order fulfillment during high-traffic Halloween period',
    startMonth: 0,
    duration: 2,
    team: 'operations',
    priority: 'medium' as const,
    status: 'in-progress' as const,
    userStories: [
      'As a customer, I want fast and reliable order processing',
      'As operations, I want efficient inventory management'
    ],
    deliverables: [
      'Inventory optimization plan',
      'Customer service training',
      'Shipping partner coordination',
      'Quality assurance protocols'
    ],
    successCriteria: [
      'Order processing time <24 hours',
      'Customer satisfaction >90%',
      'Zero stockouts on key items'
    ],
    risks: ['Shipping delays', 'Inventory shortages', 'High customer service volume'],
    relatedIdeas: ['Holiday season prep', 'Automated fulfillment'],
    complexity: 'medium'
  }
]

export const sampleSoftwareRoadmap = [
  {
    id: 'feature-1',
    title: 'User Authentication System',
    description: 'Implement secure user authentication with OAuth and 2FA support',
    startMonth: 0,
    duration: 2,
    team: 'platform',
    priority: 'high' as const,
    status: 'in-progress' as const,
    userStories: [
      'As a user, I want to securely log into my account',
      'As a security admin, I want to enforce 2FA for sensitive accounts'
    ],
    deliverables: [
      'OAuth integration',
      '2FA implementation',
      'Password reset flow',
      'Security audit'
    ],
    successCriteria: [
      'Support 10k+ concurrent users',
      'Authentication response time <500ms',
      'Zero security breaches'
    ],
    risks: ['Security vulnerabilities', 'Third-party OAuth changes'],
    relatedIdeas: ['SSO integration', 'Biometric authentication'],
    complexity: 'high'
  },
  {
    id: 'feature-2',
    title: 'Mobile App Beta',
    description: 'Launch beta version of mobile application for iOS and Android',
    startMonth: 1,
    duration: 3,
    team: 'mobile',
    priority: 'high' as const,
    status: 'planned' as const,
    userStories: [
      'As a mobile user, I want access to core features on my phone',
      'As a beta tester, I want to provide feedback on app functionality'
    ],
    deliverables: [
      'iOS app beta',
      'Android app beta',
      'Beta testing program',
      'Feedback collection system'
    ],
    successCriteria: [
      '1000+ beta downloads',
      'App store rating >4.0',
      '90% feature parity with web'
    ],
    risks: ['App store approval delays', 'Device compatibility issues'],
    relatedIdeas: ['Progressive web app', 'Offline functionality'],
    complexity: 'high'
  }
]

export const sampleEventRoadmap = [
  {
    id: 'feature-1',
    title: 'Venue Booking & Setup',
    description: 'Secure venue and coordinate all setup logistics for the annual conference',
    startMonth: 0,
    duration: 1,
    team: 'operations',
    priority: 'high' as const,
    status: 'completed' as const,
    userStories: [
      'As an attendee, I want a comfortable and accessible venue',
      'As an organizer, I want reliable AV and networking infrastructure'
    ],
    deliverables: [
      'Venue contract signed',
      'AV equipment confirmed',
      'Catering arrangements',
      'Setup timeline'
    ],
    successCriteria: [
      'Venue capacity for 500+ attendees',
      'Backup power and internet',
      'Accessibility compliance'
    ],
    risks: ['Venue double-booking', 'Equipment failures'],
    relatedIdeas: ['Hybrid event option', 'Multiple venue partnerships'],
    complexity: 'medium'
  }
]