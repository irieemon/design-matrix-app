/**
 * ADR-0014 Step 3 — Barrel Export Verification
 *
 * T-0014-020: src/lib/ai/index.ts must NOT export AIIdeaService,
 *             AIInsightsService, or AIRoadmapService after legacy deletion.
 *
 * T-0014-021: No non-test file under src/ may import from aiIdeaService,
 *             aiRoadmapService, or aiInsightsService after legacy deletion.
 *
 * These tests FAIL before Step 3 (legacy exports/files still present) and
 * PASS after Colby completes Step 3 (files deleted, barrel cleaned).
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SRC_ROOT = path.resolve(__dirname, '../../../')

/** Recursively collect all .ts / .tsx files under a directory. */
function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(full))
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(full)
    }
  }
  return files
}

/** Returns true when a file is considered a test file. */
function isTestFile(filePath: string): boolean {
  return (
    filePath.includes('__tests__') ||
    filePath.includes('.test.') ||
    filePath.includes('.spec.')
  )
}

// ---------------------------------------------------------------------------
// T-0014-020: barrel export must not expose deleted legacy names
// ---------------------------------------------------------------------------

describe('T-0014-020: src/lib/ai/index.ts barrel export', () => {
  it('does not export AIIdeaService', async () => {
    const barrel = await import('../index')
    expect(
      (barrel as Record<string, unknown>)['AIIdeaService'],
      'AIIdeaService must not be exported from the barrel after Step 3'
    ).toBeUndefined()
  })

  it('does not export aiIdeaService singleton', async () => {
    const barrel = await import('../index')
    expect(
      (barrel as Record<string, unknown>)['aiIdeaService'],
      'aiIdeaService must not be exported from the barrel after Step 3'
    ).toBeUndefined()
  })

  it('does not export AIInsightsService', async () => {
    const barrel = await import('../index')
    expect(
      (barrel as Record<string, unknown>)['AIInsightsService'],
      'AIInsightsService must not be exported from the barrel after Step 3'
    ).toBeUndefined()
  })

  it('does not export aiInsightsService singleton', async () => {
    const barrel = await import('../index')
    expect(
      (barrel as Record<string, unknown>)['aiInsightsService'],
      'aiInsightsService must not be exported from the barrel after Step 3'
    ).toBeUndefined()
  })

  it('does not export AIRoadmapService', async () => {
    const barrel = await import('../index')
    expect(
      (barrel as Record<string, unknown>)['AIRoadmapService'],
      'AIRoadmapService must not be exported from the barrel after Step 3'
    ).toBeUndefined()
  })

  it('does not export aiRoadmapService singleton', async () => {
    const barrel = await import('../index')
    expect(
      (barrel as Record<string, unknown>)['aiRoadmapService'],
      'aiRoadmapService must not be exported from the barrel after Step 3'
    ).toBeUndefined()
  })

  it('still exports modular services (regression guard)', async () => {
    const barrel = await import('../index')
    const b = barrel as Record<string, unknown>
    expect(b['AiServiceFacade'], 'AiServiceFacade must remain exported').toBeDefined()
    expect(b['BaseAiService'], 'BaseAiService must remain exported').toBeDefined()
    expect(b['InsightsService'], 'InsightsService must remain exported').toBeDefined()
    expect(b['RoadmapService'], 'RoadmapService must remain exported').toBeDefined()
    expect(b['IdeaGenerationService'], 'IdeaGenerationService must remain exported').toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// T-0014-021: no non-test source file may import the deleted legacy modules
// ---------------------------------------------------------------------------

describe('T-0014-021: no non-test src/ file imports legacy AI services', () => {
  const LEGACY_MODULES = [
    'aiIdeaService',
    'aiRoadmapService',
    'aiInsightsService',
  ]

  /** Pattern matches any import / require that references the legacy filename. */
  const buildPattern = (moduleName: string): RegExp =>
    new RegExp(`['"](.*[\\/])?${moduleName}['"]`)

  it('no non-test file imports aiIdeaService', () => {
    const pattern = buildPattern('aiIdeaService')
    const violations: string[] = []
    for (const file of collectSourceFiles(SRC_ROOT)) {
      if (isTestFile(file)) continue
      const content = fs.readFileSync(file, 'utf8')
      if (pattern.test(content)) violations.push(path.relative(SRC_ROOT, file))
    }
    expect(violations, `Non-test files still import aiIdeaService: ${violations.join(', ')}`).toHaveLength(0)
  })

  it('no non-test file imports aiRoadmapService', () => {
    const pattern = buildPattern('aiRoadmapService')
    const violations: string[] = []
    for (const file of collectSourceFiles(SRC_ROOT)) {
      if (isTestFile(file)) continue
      const content = fs.readFileSync(file, 'utf8')
      if (pattern.test(content)) violations.push(path.relative(SRC_ROOT, file))
    }
    expect(violations, `Non-test files still import aiRoadmapService: ${violations.join(', ')}`).toHaveLength(0)
  })

  it('no non-test file imports aiInsightsService', () => {
    const pattern = buildPattern('aiInsightsService')
    const violations: string[] = []
    for (const file of collectSourceFiles(SRC_ROOT)) {
      if (isTestFile(file)) continue
      const content = fs.readFileSync(file, 'utf8')
      if (pattern.test(content)) violations.push(path.relative(SRC_ROOT, file))
    }
    expect(violations, `Non-test files still import aiInsightsService: ${violations.join(', ')}`).toHaveLength(0)
  })

  it('covers all three legacy module names in a single pass (combined check)', () => {
    const patterns = LEGACY_MODULES.map((m) => ({
      name: m,
      re: buildPattern(m),
    }))
    const violationsByModule: Record<string, string[]> = {}

    for (const file of collectSourceFiles(SRC_ROOT)) {
      if (isTestFile(file)) continue
      const content = fs.readFileSync(file, 'utf8')
      for (const { name, re } of patterns) {
        if (re.test(content)) {
          if (!violationsByModule[name]) violationsByModule[name] = []
          violationsByModule[name].push(path.relative(SRC_ROOT, file))
        }
      }
    }

    const summary = Object.entries(violationsByModule)
      .map(([mod, files]) => `${mod}: [${files.join(', ')}]`)
      .join(' | ')

    expect(
      Object.keys(violationsByModule),
      `Legacy service imports found in non-test files — ${summary}`
    ).toHaveLength(0)
  })
})
