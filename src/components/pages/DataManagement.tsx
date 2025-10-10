import { useState, useRef } from 'react'
import { Download, Upload, FileText, AlertCircle, CheckCircle, Database, Trash2 } from 'lucide-react'
import { IdeaCard } from '../../types'
import { exportToCSV, parseCSV, validateCSVFile } from '../../utils/csvUtils'
import { DatabaseService } from '../../lib/database'
import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'

interface DataManagementProps {
  ideas: IdeaCard[]
  currentUser: string
  onDataUpdated: () => void
}

const DataManagement: React.FC<DataManagementProps> = ({ ideas, currentUser, onDataUpdated }) => {
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [importMessage, setImportMessage] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    exportToCSV(ideas)
  }

  const handleImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImportStatus('loading')

    try {
      const isValid = await validateCSVFile(file)
      if (!isValid) {
        setImportStatus('error')
        setImportMessage('Please select a valid CSV file.')
        return
      }

      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const csvContent = e.target?.result as string
          const importedIdeas = parseCSV(csvContent, currentUser)
          
          // Add all imported ideas to database
          for (const idea of importedIdeas) {
            await DatabaseService.createIdea(idea, supabase)
          }
          
          setImportStatus('success')
          setImportMessage(`Successfully imported ${importedIdeas.length} ideas!`)
          onDataUpdated()
        } catch (error) {
          logger.error('Import error:', error)
          setImportStatus('error')
          setImportMessage('Error importing CSV file. Please check the format.')
        }
      }
      reader.readAsText(file)
    } catch (error) {
      setImportStatus('error')
      setImportMessage('An error occurred while processing the file.')
    }

    // Reset file input
    event.target.value = ''
  }

  const handleDeleteAll = async () => {
    try {
      for (const idea of ideas) {
        await DatabaseService.deleteIdea(idea.id, supabase)
      }
      setShowDeleteConfirm(false)
      onDataUpdated()
    } catch (error) {
      logger.error('Error deleting all ideas:', error)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Data Management</h1>
        <p className="text-slate-600">Import, export, and manage your Prioritas data</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Database className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-2xl font-bold text-slate-900">{(ideas || []).length}</span>
          </div>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Total Ideas</h3>
          <p className="text-xs text-slate-500">Ideas in your matrix</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-2xl font-bold text-slate-900">
              {(ideas || []).filter(i => i.priority === 'high' || i.priority === 'strategic').length}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">High Priority</h3>
          <p className="text-xs text-slate-500">Strategic & high priority ideas</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 rounded-xl">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-2xl font-bold text-slate-900">
              {new Set((ideas || []).map(i => i.created_by)).size}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Contributors</h3>
          <p className="text-xs text-slate-500">Unique idea creators</p>
        </div>
      </div>

      {/* Import/Export Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Section */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm flex flex-col h-full">
          <div className="mb-6 flex-grow">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Export Data</h3>
            <p className="text-sm text-slate-600">Download all your ideas as a CSV file for backup or sharing</p>
          </div>
          
          <div className="mt-auto">
            <button
              onClick={handleExport}
              disabled={(ideas || []).length === 0}
              className="w-full flex items-center justify-center space-x-3 bg-emerald-600 text-white px-6 py-4 rounded-xl hover:bg-emerald-700 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              <span className="font-medium">Export to CSV</span>
            </button>
            
            {(ideas || []).length === 0 && (
              <p className="text-xs text-slate-500 mt-2 text-center">No ideas to export</p>
            )}
          </div>
        </div>

        {/* Import Section */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm flex flex-col h-full">
          <div className="mb-6 flex-grow">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Import Data</h3>
            <p className="text-sm text-slate-600">Upload a CSV file to bulk-import ideas into your matrix</p>
          </div>
          
          <div className="mt-auto">
            <button
              onClick={handleImport}
              disabled={importStatus === 'loading'}
              className="w-full flex items-center justify-center space-x-3 bg-blue-600 text-white px-6 py-4 rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm disabled:opacity-50"
            >
              {importStatus === 'loading' ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-medium">Importing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span className="font-medium">Import from CSV</span>
                </>
              )}
            </button>

            {/* Import Status */}
            {importStatus === 'success' && (
              <div className="mt-4 flex items-center space-x-2 text-emerald-600 bg-emerald-50 px-4 py-3 rounded-lg">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{importMessage}</span>
              </div>
            )}

            {importStatus === 'error' && (
              <div className="mt-4 flex items-center space-x-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{importMessage}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      {(ideas || []).length > 0 && (
        <div className="bg-red-50 border border-red-200/60 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Danger Zone</h3>
          <p className="text-sm text-red-700 mb-4">Permanently delete all ideas from your matrix. This action cannot be undone.</p>
          
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete All Ideas</span>
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-red-800">Are you sure? This will delete all {(ideas || []).length} ideas permanently.</p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAll}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete All Ideas
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  )
}

export default DataManagement