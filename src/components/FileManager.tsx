import { useState } from 'react'
import { FileText, Image, File, Download, Trash2, Eye, Calendar, User, FileIcon } from 'lucide-react'
import { ProjectFile, FileType } from '../types'
import DeleteConfirmModal from './DeleteConfirmModal'
import { logger } from '../utils/logger'

interface FileManagerProps {
  files: ProjectFile[]
  onDeleteFile: (fileId: string) => void
  onViewFile?: (file: ProjectFile) => void
}

const FileManager: React.FC<FileManagerProps> = ({ files, onDeleteFile, onViewFile }) => {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    fileId?: string
    fileName?: string
    isMultiple?: boolean
  }>({ isOpen: false })

  const downloadFile = (file: ProjectFile) => {
    if (!file.file_data) {
      logger.warn('No file data available for download:', file.original_name)
      alert(`Cannot download "${file.original_name}". File data is not available. Please re-upload the file to enable downloads.`)
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
    } catch (error) {
      logger.error('Error downloading file:', error)
      alert('Failed to download file. Please try again.')
    }
  }

  const getFileIcon = (fileType: FileType, size = 'w-5 h-5') => {
    switch (fileType) {
      case 'pdf':
        return <FileText className={`${size} text-red-600`} />
      case 'doc':
      case 'docx':
        return <FileText className={`${size} text-blue-600`} />
      case 'txt':
      case 'md':
        return <FileIcon className={`${size} text-gray-600`} />
      case 'image':
        return <Image className={`${size} text-green-600`} />
      default:
        return <File className={`${size} text-gray-600`} />
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
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleSelectFile = (fileId: string) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    )
  }

  const handleSelectAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([])
    } else {
      setSelectedFiles(files.map(f => f.id))
    }
  }

  const handleBulkDelete = () => {
    setDeleteModal({
      isOpen: true,
      isMultiple: true
    })
  }

  const openDeleteModal = (file: ProjectFile) => {
    setDeleteModal({
      isOpen: true,
      fileId: file.id,
      fileName: file.original_name,
      isMultiple: false
    })
  }

  const handleConfirmDelete = () => {
    if (deleteModal.isMultiple && selectedFiles.length > 0) {
      // Bulk delete
      selectedFiles.forEach(fileId => onDeleteFile(fileId))
      setSelectedFiles([])
    } else if (deleteModal.fileId) {
      // Single file delete
      onDeleteFile(deleteModal.fileId)
    }
    setDeleteModal({ isOpen: false })
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No files uploaded</h3>
        <p className="text-gray-500">Upload some documents, images, or other files to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with bulk actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium text-gray-900">
            Uploaded Files ({files.length})
          </h3>
          {files.length > 0 && (
            <label className="flex items-center space-x-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedFiles.length === files.length}
                onChange={handleSelectAll}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Select all</span>
            </label>
          )}
        </div>
        
        {selectedFiles.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {selectedFiles.length} selected
            </span>
            <button
              onClick={handleBulkDelete}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>

      {/* Files List */}
      <div className="space-y-2">
        {files.map((file) => (
          <div
            key={file.id}
            className={`
              flex items-center space-x-4 p-4 border rounded-lg transition-colors
              ${selectedFiles.includes(file.id) 
                ? 'border-blue-200 bg-blue-50' 
                : 'border-gray-200 hover:bg-gray-50'
              }
            `}
          >
            {/* Checkbox */}
            <input
              type="checkbox"
              checked={selectedFiles.includes(file.id)}
              onChange={() => handleSelectFile(file.id)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />

            {/* File Icon */}
            <div className="flex-shrink-0">
              {getFileIcon(file.file_type, 'w-8 h-8')}
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {file.original_name}
              </h4>
              <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                <span className="flex items-center space-x-1">
                  <File className="w-3 h-3" />
                  <span>{formatFileSize(file.file_size)}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(file.created_at)}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <User className="w-3 h-3" />
                  <span>{file.uploader?.full_name || file.uploader?.email || 'Unknown'}</span>
                </span>
              </div>
              {file.content_preview && (
                <p className="text-xs text-gray-400 mt-2 truncate">
                  Preview: {file.content_preview.substring(0, 100)}...
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              {onViewFile && (
                <button
                  onClick={() => onViewFile(file)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="View file"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => downloadFile(file)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Download file"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => openDeleteModal(file)}
                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete file"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-500 pt-2 border-t">
        Total: {files.length} files, {formatFileSize(files.reduce((sum, f) => sum + f.file_size, 0))}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false })}
        onConfirm={handleConfirmDelete}
        title={deleteModal.isMultiple ? "Delete Files" : "Delete File"}
        message={
          deleteModal.isMultiple
            ? `Are you sure you want to delete ${selectedFiles.length} selected files? This action cannot be undone.`
            : `Are you sure you want to delete "${deleteModal.fileName}"? This action cannot be undone.`
        }
        confirmText="Delete"
        isDangerous={true}
      />
    </div>
  )
}

export default FileManager