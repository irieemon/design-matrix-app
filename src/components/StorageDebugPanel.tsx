/**
 * Storage Debug Panel Component
 * For debugging Supabase storage path issues
 */

import React, { useState } from 'react'
import { Bug, Search, Database, Upload, List } from 'lucide-react'
import { StorageDebugger } from '../lib/storageDebugger'
import { logger } from '../utils/logger'

interface StorageDebugPanelProps {
  projectId?: string
  onClose?: () => void
}

const StorageDebugPanel: React.FC<StorageDebugPanelProps> = ({ projectId, onClose }) => {
  const [debugProjectId, setDebugProjectId] = useState(projectId || '')
  const [fileName, setFileName] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<string[]>([])

  const addResult = (message: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const runDebug = async (debugType: string) => {
    if (!debugProjectId) {
      addResult('❌ Please enter a project ID')
      return
    }

    setIsRunning(true)
    addResult(`🔍 Starting ${debugType} for project: ${debugProjectId}`)

    try {
      switch (debugType) {
        case 'file-access':
          await StorageDebugger.debugFileAccess(debugProjectId, fileName || undefined)
          addResult('✅ File access debug completed')
          break
        
        case 'database-paths':
          await StorageDebugger.verifyDatabasePaths(debugProjectId)
          addResult('✅ Database path verification completed')
          break
        
        case 'list-files':
          await StorageDebugger.listAllProjectFiles(debugProjectId)
          addResult('✅ File listing completed')
          break
        
        case 'test-upload':
          await StorageDebugger.testUploadRetrievalFlow(debugProjectId)
          addResult('✅ Upload/retrieval test completed')
          break
        
        default:
          addResult('❌ Unknown debug type')
      }
    } catch (_error) {
      addResult(`❌ Debug failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      logger.error('Debug panel error:', error)
    } finally {
      setIsRunning(false)
    }
  }

  const clearResults = () => {
    setResults([])
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <Bug className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-semibold text-gray-900">Storage Debug Panel</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100"
            >
              ✕
            </button>
          )}
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Input Section */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project ID (Required)
              </label>
              <input
                type="text"
                value={debugProjectId}
                onChange={(e) => setDebugProjectId(e.target.value)}
                placeholder="Enter project ID to debug"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                File Name (Optional)
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Enter specific filename to search for"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Debug Actions */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => runDebug('file-access')}
              disabled={isRunning}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search className="w-5 h-5" />
              <span>Debug File Access</span>
            </button>

            <button
              onClick={() => runDebug('database-paths')}
              disabled={isRunning}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Database className="w-5 h-5" />
              <span>Verify DB Paths</span>
            </button>

            <button
              onClick={() => runDebug('list-files')}
              disabled={isRunning}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <List className="w-5 h-5" />
              <span>List All Files</span>
            </button>

            <button
              onClick={() => runDebug('test-upload')}
              disabled={isRunning}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-5 h-5" />
              <span>Test Upload Flow</span>
            </button>
          </div>

          {/* Results Section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Debug Results</h3>
              <button
                onClick={clearResults}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50"
              >
                Clear
              </button>
            </div>

            <div className="bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-lg h-64 overflow-y-auto">
              {results.length === 0 ? (
                <div className="text-gray-500">No debug output yet. Click a debug button to start.</div>
              ) : (
                results.map((result, index) => (
                  <div key={index} className="mb-1">
                    {result}
                  </div>
                ))
              )}
              {isRunning && (
                <div className="text-yellow-400 animate-pulse">
                  🔄 Running debug operation...
                </div>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Debug Instructions</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li><strong>Debug File Access:</strong> Checks if files can be accessed and lists directory contents</li>
              <li><strong>Verify DB Paths:</strong> Compares database storage_path values with actual storage</li>
              <li><strong>List All Files:</strong> Shows complete file structure for the project</li>
              <li><strong>Test Upload Flow:</strong> Tests the complete upload → store → retrieve process</li>
            </ul>
            <p className="text-sm text-blue-700 mt-2">
              <strong>Note:</strong> Check the browser console for detailed debug output. Results here show summary information.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StorageDebugPanel