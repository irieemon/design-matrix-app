import React, { useState } from 'react'
import { AlertTriangle, CheckCircle, Settings, Upload, RefreshCw } from 'lucide-react'
import { logger } from '../lib/logging'

interface StorageRepairPanelProps {
  projectId?: string
}

const StorageRepairPanel: React.FC<StorageRepairPanelProps> = ({ projectId }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const runRepairAction = async (action: string, additionalData: any = {}) => {
    setIsLoading(true)
    setError(null)

    try {
      logger.debug('Running storage repair action', { action })

      const response = await fetch('/api/debug/repair-storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          projectId,
          ...additionalData
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      setResults((prev: any) => ({
        ...prev,
        [action]: data
      }))

      logger.debug('Repair action completed', { action, data })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`${action} failed: ${errorMessage}`)
      logger.error('Repair action failed', { action, error: err })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg border">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
          <Settings className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Storage Repair Panel</h2>
          <p className="text-sm text-gray-600">Diagnose and fix Supabase Storage issues</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-red-800 font-medium">Error</span>
          </div>
          <p className="text-red-700 mt-2">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Check Bucket */}
        <button
          onClick={() => runRepairAction('check_bucket')}
          disabled={isLoading}
          className="p-4 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed text-left"
        >
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-gray-900">1. Check Bucket Status</span>
          </div>
          <p className="text-sm text-gray-600">Verify if project-files bucket exists</p>
        </button>

        {/* Create Bucket */}
        <button
          onClick={() => runRepairAction('create_bucket')}
          disabled={isLoading}
          className="p-4 border border-green-200 rounded-lg hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed text-left"
        >
          <div className="flex items-center gap-3 mb-2">
            <Upload className="w-5 h-5 text-green-600" />
            <span className="font-medium text-gray-900">2. Create Bucket</span>
          </div>
          <p className="text-sm text-gray-600">Create project-files bucket if missing</p>
        </button>

        {/* Test Upload */}
        <button
          onClick={() => runRepairAction('test_upload')}
          disabled={isLoading}
          className="p-4 border border-purple-200 rounded-lg hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed text-left"
        >
          <div className="flex items-center gap-3 mb-2">
            <RefreshCw className="w-5 h-5 text-purple-600" />
            <span className="font-medium text-gray-900">3. Test Upload</span>
          </div>
          <p className="text-sm text-gray-600">Verify upload permissions work</p>
        </button>

        {/* List Missing Files */}
        <button
          onClick={() => runRepairAction('list_missing_files')}
          disabled={isLoading || !projectId}
          className="p-4 border border-orange-200 rounded-lg hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed text-left"
        >
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <span className="font-medium text-gray-900">4. List Missing Files</span>
          </div>
          <p className="text-sm text-gray-600">Find files in DB but not in storage</p>
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Running repair action...</span>
        </div>
      )}

      {results && (
        <div className="space-y-6">
          {Object.entries(results).map(([action, data]: [string, any]) => (
            <div key={action} className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2 capitalize">
                {action.replace('_', ' ')} Results
              </h3>
              <pre className="text-xs text-gray-700 bg-white p-3 rounded border overflow-auto max-h-64">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}

      {results?.check_bucket && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Bucket Status Summary</h3>
          <div className="space-y-1 text-sm">
            <p>✅ Buckets found: {results.check_bucket.bucketsFound}</p>
            <p>🪣 Project-files bucket exists: {results.check_bucket.projectFilesBucketExists ? 'Yes' : 'No'}</p>
            {results.check_bucket.needsRepair && (
              <p className="text-orange-700 font-medium">⚠️ Repair needed: Create the project-files bucket</p>
            )}
          </div>
        </div>
      )}

      {results?.list_missing_files && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="font-medium text-red-900 mb-2">Missing Files Summary</h3>
          <div className="space-y-1 text-sm">
            <p>📁 Total files in DB: {results.list_missing_files.totalFiles}</p>
            <p>❌ Missing from storage: {results.list_missing_files.missingFiles}</p>
            {results.list_missing_files.allFilesMissing && (
              <p className="text-red-700 font-medium">🚨 All files are missing from storage!</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default StorageRepairPanel