# Admin System Architecture Diagram

## High-Level System Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[Admin Interface]
        AC[AdminContext]
        AS[AdminService]
    end

    subgraph "Authentication Layer"
        AUTH[useAuth Hook]
        ROLE[Role Detection]
        SESSION[Session Management]
    end

    subgraph "Backend Layer"
        API[Admin API Endpoints]
        MW[Admin Middleware]
        SRC[Service Role Client]
    end

    subgraph "Database Layer"
        PG[(PostgreSQL)]
        RLS[Row Level Security]
        BYPASS[RLS Bypass]
    end

    subgraph "Configuration Layer"
        ENV[Environment Config]
        AUDIT[Audit Logging]
        SEC[Security Policies]
    end

    %% Frontend connections
    UI --> AC
    AC --> AS
    AC --> AUTH

    %% Authentication flow
    AUTH --> ROLE
    ROLE --> SESSION

    %% Backend connections
    AS --> API
    API --> MW
    MW --> SRC

    %% Database access
    SRC --> BYPASS
    BYPASS --> PG
    RLS --> PG

    %% Configuration
    ROLE --> ENV
    MW --> SEC
    API --> AUDIT

    %% Styling
    classDef frontend fill:#e1f5fe
    classDef auth fill:#f3e5f5
    classDef backend fill:#e8f5e8
    classDef database fill:#fff3e0
    classDef config fill:#fce4ec

    class UI,AC,AS frontend
    class AUTH,ROLE,SESSION auth
    class API,MW,SRC backend
    class PG,RLS,BYPASS database
    class ENV,AUDIT,SEC config
```

## Admin Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Admin Interface
    participant AC as AdminContext
    participant AUTH as useAuth
    participant AS as AdminService
    participant API as Backend API
    participant DB as Database

    User->>UI: Login with admin email
    UI->>AUTH: authenticate(credentials)
    AUTH->>API: POST /api/auth/user
    API->>DB: Check user profile
    DB-->>API: User data with role
    API-->>AUTH: User profile
    AUTH->>AC: Initialize admin context

    AC->>AS: verifyAdminStatus(userId)
    AS->>API: GET /api/admin/verify
    API->>DB: Query with service role
    DB-->>API: Admin verification
    API-->>AS: Admin status
    AS-->>AC: Verified admin

    AC->>UI: Enable admin capabilities
    UI->>User: Show admin interface

    Note over User,DB: Admin can now access cross-user data
    User->>UI: View all projects
    UI->>AS: getAllProjects()
    AS->>API: GET /api/admin/projects
    API->>DB: Service role query (bypass RLS)
    DB-->>API: All projects data
    API-->>AS: Projects list
    AS-->>UI: Display projects
    UI->>User: Show all user projects
```

## Service Role Architecture

```mermaid
graph LR
    subgraph "Client Side"
        FC[Frontend Code]
        AC[Anonymous Key Client]
    end

    subgraph "Server Side"
        API[API Endpoints]
        MW[Admin Middleware]
        SRC[Service Role Client]
    end

    subgraph "Database"
        RLS[RLS Policies]
        DATA[(User Data)]
    end

    %% Regular user flow
    FC -->|"Regular Operations"| AC
    AC -->|"Filtered by auth.uid()"| RLS
    RLS --> DATA

    %% Admin flow
    FC -->|"Admin Operations"| API
    API --> MW
    MW -->|"Verify Admin Role"| MW
    MW -->|"High Privilege"| SRC
    SRC -->|"Bypass RLS"| DATA

    %% Styling
    classDef client fill:#e3f2fd
    classDef server fill:#e8f5e8
    classDef database fill:#fff3e0

    class FC,AC client
    class API,MW,SRC server
    class RLS,DATA database
```

## Role-Based Access Control

```mermaid
graph TB
    subgraph "User Roles"
        USER[Regular User]
        ADMIN[Admin]
        SUPER[Super Admin]
    end

    subgraph "Capabilities"
        VIEW_OWN[View Own Data]
        VIEW_ALL[View All Data]
        MANAGE_USERS[Manage Users]
        MANAGE_ROLES[Manage Roles]
        DELETE_ANY[Delete Any Project]
        SYSTEM_ADMIN[System Admin]
    end

    subgraph "Database Access"
        OWN_DATA[Own Records Only]
        ALL_DATA[All Records]
        BYPASS_RLS[RLS Bypass]
    end

    %% Role capabilities
    USER --> VIEW_OWN
    ADMIN --> VIEW_ALL
    ADMIN --> MANAGE_USERS
    SUPER --> MANAGE_ROLES
    SUPER --> DELETE_ANY
    SUPER --> SYSTEM_ADMIN

    %% Database access patterns
    VIEW_OWN --> OWN_DATA
    VIEW_ALL --> ALL_DATA
    MANAGE_USERS --> BYPASS_RLS
    MANAGE_ROLES --> BYPASS_RLS
    DELETE_ANY --> BYPASS_RLS
    SYSTEM_ADMIN --> BYPASS_RLS

    %% Styling
    classDef role fill:#e1f5fe
    classDef capability fill:#f3e5f5
    classDef database fill:#fff3e0

    class USER,ADMIN,SUPER role
    class VIEW_OWN,VIEW_ALL,MANAGE_USERS,MANAGE_ROLES,DELETE_ANY,SYSTEM_ADMIN capability
    class OWN_DATA,ALL_DATA,BYPASS_RLS database
```

## Environment Configuration Flow

```mermaid
graph TB
    subgraph "Environment Detection"
        NODE_ENV{NODE_ENV}
        APP_ENV{APP_ENV}
    end

    subgraph "Configuration Selection"
        DEV_CONFIG[Development Config]
        STAGING_CONFIG[Staging Config]
        PROD_CONFIG[Production Config]
    end

    subgraph "Admin Settings"
        ADMIN_EMAILS[Admin Email List]
        SECURITY_POLICY[Security Policies]
        SESSION_CONFIG[Session Settings]
    end

    subgraph "Runtime Behavior"
        ROLE_CHECK[Role Detection]
        AUTH_CHECK[Authentication Rules]
        AUDIT_LOG[Audit Logging]
    end

    %% Environment detection
    NODE_ENV -->|"development"| DEV_CONFIG
    NODE_ENV -->|"production"| PROD_CONFIG
    APP_ENV -->|"staging"| STAGING_CONFIG

    %% Configuration application
    DEV_CONFIG --> ADMIN_EMAILS
    STAGING_CONFIG --> ADMIN_EMAILS
    PROD_CONFIG --> ADMIN_EMAILS

    DEV_CONFIG --> SECURITY_POLICY
    STAGING_CONFIG --> SECURITY_POLICY
    PROD_CONFIG --> SECURITY_POLICY

    DEV_CONFIG --> SESSION_CONFIG
    STAGING_CONFIG --> SESSION_CONFIG
    PROD_CONFIG --> SESSION_CONFIG

    %% Runtime application
    ADMIN_EMAILS --> ROLE_CHECK
    SECURITY_POLICY --> AUTH_CHECK
    SESSION_CONFIG --> AUDIT_LOG

    %% Styling
    classDef env fill:#e3f2fd
    classDef config fill:#e8f5e8
    classDef settings fill:#fff3e0
    classDef runtime fill:#fce4ec

    class NODE_ENV,APP_ENV env
    class DEV_CONFIG,STAGING_CONFIG,PROD_CONFIG config
    class ADMIN_EMAILS,SECURITY_POLICY,SESSION_CONFIG settings
    class ROLE_CHECK,AUTH_CHECK,AUDIT_LOG runtime
```

## Security Layers

```mermaid
graph LR
    subgraph "Security Layers"
        L1[Layer 1: Email Validation]
        L2[Layer 2: Role Detection]
        L3[Layer 3: Server Verification]
        L4[Layer 4: Service Role Access]
        L5[Layer 5: Audit Logging]
    end

    subgraph "Threat Mitigation"
        T1[Prevent Unauthorized Access]
        T2[Stop Privilege Escalation]
        T3[Block Service Role Exposure]
        T4[Enable Activity Monitoring]
    end

    L1 --> T1
    L2 --> T1
    L3 --> T2
    L4 --> T3
    L5 --> T4

    %% Flow
    L1 --> L2
    L2 --> L3
    L3 --> L4
    L4 --> L5

    %% Styling
    classDef security fill:#ffebee
    classDef threat fill:#e8f5e8

    class L1,L2,L3,L4,L5 security
    class T1,T2,T3,T4 threat
```

## Data Flow: Admin Operations

```mermaid
graph TB
    subgraph "Admin Request"
        A1[Admin User Action]
        A2[Admin Interface Call]
    end

    subgraph "Frontend Processing"
        F1[AdminContext Check]
        F2[AdminService Method]
        F3[API Request]
    end

    subgraph "Backend Processing"
        B1[Admin Middleware]
        B2[Role Verification]
        B3[Service Role Query]
    end

    subgraph "Database Operations"
        D1[RLS Bypass]
        D2[Cross-User Data Access]
        D3[Audit Log Entry]
    end

    %% Flow
    A1 --> A2
    A2 --> F1
    F1 --> F2
    F2 --> F3
    F3 --> B1
    B1 --> B2
    B2 --> B3
    B3 --> D1
    D1 --> D2
    D2 --> D3

    %% Return flow
    D3 --> B3
    B3 --> F3
    F3 --> F2
    F2 --> A2
    A2 --> A1

    %% Styling
    classDef admin fill:#e1f5fe
    classDef frontend fill:#f3e5f5
    classDef backend fill:#e8f5e8
    classDef database fill:#fff3e0

    class A1,A2 admin
    class F1,F2,F3 frontend
    class B1,B2,B3 backend
    class D1,D2,D3 database
```

This architectural diagram system provides a comprehensive visual representation of how the admin system components interact, from the high-level architecture down to the detailed security layers and data flows.