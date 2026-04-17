#!/usr/bin/env node
// Verifies production bundle contains none of the 5 mock-data-generator method names (T-0016-054..058).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const projectRoot = path.join(__dirname, '..')
const distPath = path.join(projectRoot, 'dist')
const assetsPath = path.join(distPath, 'assets')

// T-0016-054 through T-0016-058.
// NOTE: generateMockIdea (T-0016-055) is a substring of generateMockIdeas (T-0016-054).
// Both are listed as separate test IDs deliberately: the singular form catches a renamed
// helper that drops the plural. If generateMockIdeas exists in the bundle, both T-0016-054
// AND T-0016-055 will be reported as failing -- this is correct, not a duplicate.
const FORBIDDEN = [
  { string: 'generateMockIdeas',                  tid: 'T-0016-054' },
  { string: 'generateMockIdea',                   tid: 'T-0016-055' },
  { string: 'generateMockRoadmap',                tid: 'T-0016-056' },
  { string: 'generateProjectSpecificMockInsights', tid: 'T-0016-057' },
  { string: 'generateMockInsightsWithFiles',       tid: 'T-0016-058' },
]

if (!fs.existsSync(distPath) || !fs.existsSync(assetsPath)) {
  process.stderr.write(
    `ERROR: dist/assets/ not found at ${assetsPath}\n` +
    `Run \`npm run build\` first, then re-run this script.\n`
  )
  process.exit(1)
}

const bundleFiles = fs.readdirSync(assetsPath).filter(f => f.endsWith('.js'))

if (bundleFiles.length === 0) {
  process.stderr.write(
    `ERROR: No .js files found in ${assetsPath}\n` +
    `Run \`npm run build\` first, then re-run this script.\n`
  )
  process.exit(1)
}

const failures = []

for (const file of bundleFiles) {
  const filePath = path.join(assetsPath, file)
  const content = fs.readFileSync(filePath, 'utf8')

  for (const { string, tid } of FORBIDDEN) {
    // Word-boundary regex prevents generateMockIdea from matching inside
    // generateMockIdeas (T-0016-055 must not false-positive when only
    // T-0016-054's symbol is present).
    const pattern = new RegExp(`\\b${string}\\b`)
    if (pattern.test(content)) {
      failures.push({ tid, string, file })
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`FAIL: Mock method names found in production bundle:\n`)
  for (const { tid, string, file } of failures) {
    process.stderr.write(`  ${tid}  "${string}"  in ${file}\n`)
  }
  process.exitCode = 1
  process.exit(1)
}

process.stdout.write(
  `✓ Bundle verification passed: 5/5 forbidden strings absent from ${bundleFiles.length} bundle file${bundleFiles.length === 1 ? '' : 's'}.\n`
)
