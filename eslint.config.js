/**
 * ESLint v9 Flat Config
 *
 * ✅ MIGRATION: Converted from .eslintrc.json to flat config format for ESLint v9
 * - Uses new import-based configuration
 * - typescript-eslint is now a combined package (replaces @typescript-eslint/parser + @typescript-eslint/eslint-plugin)
 * - Flat config array format instead of extends/plugins
 */

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  // Base ESLint recommended rules
  js.configs.recommended,

  // TypeScript ESLint recommended rules
  ...tseslint.configs.recommended,

  // Global ignores (applies to all configs)
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      'api/',  // Backend API directory (separate TypeScript project)
      'claudedocs/',  // Claude Code documentation and utility scripts
      'tests/',  // Test files (separate configuration)
      'scripts/',  // Utility scripts
      '*.config.js',
      '*.config.ts',
      '*.config.mjs',
      'vite.config.ts',
      'playwright.config.ts',
      'vitest.config.ts',
      'playwright.*.config.*',
      'vitest.*.config.*',
      '**/__tests__/**',
      '**/test/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      'src/components/debug/**',
      'src/components/dev/**',
      'src/pages/ComponentShowcase.tsx',
      'src/test/**'
    ]
  },

  // Main configuration for TypeScript and React files
  {
    files: ['**/*.{ts,tsx,js,jsx}'],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        project: './tsconfig.json'
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node
      }
    },

    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react': react,
      'react-hooks': reactHooks
    },

    settings: {
      react: {
        version: 'detect'
      }
    },

    rules: {
      // Console restrictions
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // React rules
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // TypeScript rules
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
        'caughtErrorsIgnorePattern': '^_'
      }],

      // React Hooks rules (recommended)
      ...reactHooks.configs.recommended.rules
    }
  }
)
