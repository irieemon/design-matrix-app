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

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <NavigationProvider>
      <ProjectProvider>
        <ModalProvider>
          {children}
        </ModalProvider>
      </ProjectProvider>
    </NavigationProvider>
  )
}