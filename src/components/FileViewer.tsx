import { X, FileText, Image, Download, Play, Volume2 } from 'lucide-react'
import { ProjectFile } from '../types'
import { logger } from '../utils/logger'
import { useToast } from '../contexts/ToastContext'
import { FileService } from '../lib/fileService'
import { useState, useEffect } from 'react'
import PDFViewer from './PDFViewer'

interface FileViewerProps {
  file: ProjectFile | null
  isOpen: boolean
  onClose: () => void
}

const FileViewer: React.FC<FileViewerProps> = ({ file, isOpen, onClose }) => {
  const { showError, showWarning } = useToast()
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [isLoadingUrl, setIsLoadingUrl] = useState(false)

  // Helper function to determine file type from MIME type
  const getFileTypeFromMime = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    if (mimeType === 'application/pdf') return 'pdf'
    if (mimeType.startsWith('text/') || 
        mimeType === 'application/json' ||
        mimeType === 'application/xml' ||
        mimeType === 'application/javascript') return 'text'
    return file?.file_type || 'document'
  }

  const actualFileType = file ? getFileTypeFromMime(file.mime_type) : 'document'

  // Load file URL when file changes
  useEffect(() => {
    if (!file || !isOpen) {
      setFileUrl(null)
      return
    }

    // If we already have file_data (base64), use it directly
    if (file.file_data) {
      setFileUrl(file.file_data)
      return
    }

    // Otherwise, load from storage
    const loadFileUrl = async () => {
      setIsLoadingUrl(true)
      try {
        const url = await FileService.getFileUrl(file.storage_path)
        setFileUrl(url)
      } catch (_error) {
        logger.error('Failed to load file URL:', error)
        setFileUrl(null)
      } finally {
        setIsLoadingUrl(false)
      }
    }

    // Call async function without returning its Promise
    void loadFileUrl()
  }, [file, isOpen])

  // Early return after all hooks
  if (!isOpen || !file) return null

  const downloadFile = (file: ProjectFile) => {
    if (!file.file_data) {
      logger.warn('No file data available for download:', file.original_name)
      showWarning(`Cannot download "${file.original_name}". File data is not available. Please re-upload the file to enable downloads.`)
      return
    }

    try {
      // Convert base64 to blob
      const byteCharacters = atob(file.file_data.split(',')[1])
      const byteNumbers = new Array(byteCharacters.length)
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: file.mime_type })
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.original_name
      
      // Trigger download
      document.body.appendChild(link)
      link.click()
      
      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (_error) {
      logger.error('Error downloading file:', error)
      showError('Failed to download file. Please try again.')
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const renderFileContent = () => {
    // Show loading state while fetching URL
    if (isLoadingUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-96 bg-gray-50 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading file preview...</p>
        </div>
      )
    }

    // For images, show the actual image
    if (actualFileType === 'image' && fileUrl) {
      return (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-4">
            <Image className="w-5 h-5 text-gray-600" />
            <h4 className="text-sm font-medium text-gray-900">Image Preview</h4>
          </div>
          <div className="flex justify-center bg-white rounded-lg p-4 border">
            <img 
              src={fileUrl} 
              alt={file.original_name}
              className="max-h-96 max-w-full object-contain rounded-lg shadow-sm"
              onError={(e) => {
                // Fallback if image fails to load
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                target.nextElementSibling?.classList.remove('hidden')
              }}
            />
            <div className="hidden flex flex-col items-center justify-center h-96 text-gray-500">
              <Image className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-sm">Failed to load image preview</p>
              <p className="text-xs mt-2">File: {file.original_name}</p>
            </div>
          </div>
        </div>
      )
    }

    // For images without fileUrl, show placeholder
    if (actualFileType === 'image') {
      return (
        <div className="flex flex-col items-center justify-center h-96 bg-gray-50 rounded-lg">
          <Image className="w-16 h-16 text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">Image Preview</p>
          <p className="text-sm text-gray-500">
            Unable to load image preview
          </p>
          <p className="text-xs text-gray-400 mt-2">
            File: {file.original_name}
          </p>
        </div>
      )
    }

    // For videos, show the actual video player
    if (actualFileType === 'video' && fileUrl) {
      return (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-4">
            <Play className="w-5 h-5 text-gray-600" />
            <h4 className="text-sm font-medium text-gray-900">Video Preview</h4>
          </div>
          <div className="flex justify-center bg-black rounded-lg overflow-hidden">
            <video 
              controls 
              className="max-h-96 max-w-full"
              onError={() => {
                logger.warn('Failed to load video:', file.original_name)
              }}
            >
              <source src={fileUrl} type={file.mime_type} />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )
    }

    // For videos without fileUrl, show placeholder
    if (actualFileType === 'video') {
      return (
        <div className="flex flex-col items-center justify-center h-96 bg-gray-50 rounded-lg">
          <Play className="w-16 h-16 text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">Video Preview</p>
          <p className="text-sm text-gray-500">
            Unable to load video preview
          </p>
          <p className="text-xs text-gray-400 mt-2">
            File: {file.original_name}
          </p>
        </div>
      )
    }

    // For audio files, show the actual audio player
    if (actualFileType === 'audio' && fileUrl) {
      return (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-4">
            <Volume2 className="w-5 h-5 text-gray-600" />
            <h4 className="text-sm font-medium text-gray-900">Audio Preview</h4>
          </div>
          <div className="flex justify-center bg-white rounded-lg p-8 border">
            <audio 
              controls 
              className="w-full max-w-md"
              onError={() => {
                logger.warn('Failed to load audio:', file.original_name)
              }}
            >
              <source src={fileUrl} type={file.mime_type} />
              Your browser does not support the audio tag.
            </audio>
          </div>
        </div>
      )
    }

    // For audio without fileUrl, show placeholder
    if (actualFileType === 'audio') {
      return (
        <div className="flex flex-col items-center justify-center h-96 bg-gray-50 rounded-lg">
          <Volume2 className="w-16 h-16 text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">Audio Preview</p>
          <p className="text-sm text-gray-500">
            Unable to load audio preview
          </p>
          <p className="text-xs text-gray-400 mt-2">
            File: {file.original_name}
          </p>
        </div>
      )
    }

    // For PDF files with file_data, show CSP-compliant PDF viewer
    if (actualFileType === 'pdf' && fileUrl) {
      return (
        <PDFViewer
          fileUrl={fileUrl}
          fileName={file.original_name}
          onDownload={() => downloadFile(file)}
        />
      )
    }

    // For text files and PDFs with content preview
    if (file.content_preview && (actualFileType === 'text' || actualFileType === 'pdf')) {
      return (
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <FileText className="w-5 h-5 text-gray-600" />
            <h4 className="text-sm font-medium text-gray-900">Content Preview</h4>
          </div>
          <div className="bg-white border rounded-lg p-4 max-h-96 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
              {file.content_preview}
            </pre>
          </div>
        </div>
      )
    }

    // For PDFs and other documents
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gray-50 rounded-lg">
        <FileText className="w-16 h-16 text-gray-400 mb-4" />
        <p className="text-gray-600 mb-2">Document Preview</p>
        <p className="text-sm text-gray-500 text-center max-w-md">
          Preview not available for {actualFileType.toUpperCase()} files. 
          Download the file to view its content.
        </p>
        <button 
          onClick={() => downloadFile(file)}
          className="flex items-center space-x-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Download File</span>
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {file.original_name}
            </h3>
            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
              <span>{formatFileSize(file.file_size)}</span>
              <span>•</span>
              <span>{file.file_type.toUpperCase()}</span>
              <span>•</span>
              <span>Uploaded {formatDate(file.created_at)}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={() => downloadFile(file)}
              className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Download file"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-6">
            {/* File Details */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                  File Name
                </label>
                <p className="mt-1 text-sm text-gray-900">{file.name}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                  MIME Type
                </label>
                <p className="mt-1 text-sm text-gray-900">{file.mime_type}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Uploaded By
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {file.uploader?.full_name || file.uploader?.email || 'Unknown User'}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Storage Path
                </label>
                <p className="mt-1 text-sm text-gray-900 font-mono truncate">
                  {file.storage_path}
                </p>
              </div>
            </div>

            {/* File Content */}
            {renderFileContent()}

            {/* AI Context Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-1">AI Context</h4>
                  <p className="text-sm text-blue-700">
                    This file will be used as reference material when generating AI insights, roadmaps, and ideas for your project.
                    {file.content_preview && ' Text content has been extracted and will be analyzed.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FileViewer