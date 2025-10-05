/**
 * AppProviders - Centralized context providers for the application
 *
 * Combines all context providers to eliminate provider nesting in App.tsx.
 * Provides a clean separation of concerns and eliminates prop drilling.
 */

import { ReactNode } from 'react'
import { NavigationProvider } from './NavigationContext'
import { ProjectProvider } from './ProjectContext'
import { ModalProvider } from './ModalContext'
import { ComponentStateProvider } from './ComponentStateProvider'
import { AdminProvider } from './AdminContext'
import { AuthMigrationProvider } from './AuthMigration'

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ComponentStateProvider>
      <AuthMigrationProvider>
        <AdminProvider>
          <NavigationProvider>
            <ProjectProvider>
              <ModalProvider>
                {children}
              </ModalProvider>
            </ProjectProvider>
          </NavigationProvider>
        </AdminProvider>
      </AuthMigrationProvider>
    </ComponentStateProvider>
  )
}