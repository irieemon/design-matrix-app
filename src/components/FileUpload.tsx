import { useState, useRef } from 'react'
import { Upload, X, FileText, AlertCircle } from 'lucide-react'
import { ProjectFile, User, Project, FileType } from '../types'

interface FileUploadProps {
  currentProject: Project
  currentUser: User
  onFilesUploaded: (files: ProjectFile[]) => void
  maxFileSize?: number // in MB, default 10MB
  allowedTypes?: string[] // MIME types
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  currentProject, 
  currentUser, 
  onFilesUploaded,
  maxFileSize = 10,
  allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getFileType = (mimeType: string): FileType => {
    if (mimeType === 'application/pdf') return 'pdf'
    if (mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'doc'
    if (mimeType === 'text/plain') return 'txt'
    if (mimeType === 'text/markdown') return 'md'
    if (mimeType.startsWith('image/')) return 'image'
    return 'other'
  }

  // Helper functions for file handling
  // const getFileIcon = (fileType: FileType) => {
  //   switch (fileType) {
  //     case 'pdf':
  //       return <FileText className="w-6 h-6 text-red-600" />
  //     case 'doc':
  //     case 'docx':
  //       return <FileText className="w-6 h-6 text-blue-600" />
  //     case 'txt':
  //     case 'md':
  //       return <FileIcon className="w-6 h-6 text-gray-600" />
  //     case 'image':
  //       return <Image className="w-6 h-6 text-green-600" />
  //     default:
  //       return <File className="w-6 h-6 text-gray-600" />
  //   }
  // }

  // const formatFileSize = (bytes: number): string => {
  //   if (bytes === 0) return '0 Bytes'
  //   const k = 1024
  //   const sizes = ['Bytes', 'KB', 'MB', 'GB']
  //   const i = Math.floor(Math.log(bytes) / Math.log(k))
  //   return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  // }

  const validateFile = (file: File): boolean => {
    // Check file size
    if (file.size > maxFileSize * 1024 * 1024) {
      setError(`File "${file.name}" is too large. Maximum size is ${maxFileSize}MB.`)
      return false
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
      setError(`File type "${file.type}" is not supported.`)
      return false
    }

    return true
  }

  const readFileContent = async (file: File): Promise<string | undefined> => {
    // Only extract content from text-based files
    if (file.type === 'text/plain' || file.type === 'text/markdown') {
      try {
        return await file.text()
      } catch (error) {
        console.warn('Could not read file content:', error)
        return undefined
      }
    }
    return undefined
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = error => reject(error)
    })
  }

  const handleFiles = async (files: FileList) => {
    setError(null)
    setUploading(true)

    const validFiles: File[] = []
    
    // Validate all files first
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (validateFile(file)) {
        validFiles.push(file)
      } else {
        setUploading(false)
        return
      }
    }

    try {
      const uploadedFiles: ProjectFile[] = []

      for (const file of validFiles) {
        // Read content preview for text files
        const contentPreview = await readFileContent(file)
        
        // Convert file to base64 for storage
        const base64Data = await fileToBase64(file)

        // Create a mock uploaded file (in a real app, you'd upload to Supabase Storage)
        const uploadedFile: ProjectFile = {
          id: crypto.randomUUID(),
          project_id: currentProject.id,
          name: file.name.replace(/[^a-zA-Z0-9.-]/g, '_'), // sanitized name
          original_name: file.name,
          file_type: getFileType(file.type),
          file_size: file.size,
          mime_type: file.type,
          storage_path: `projects/${currentProject.id}/files/${crypto.randomUUID()}_${file.name}`,
          content_preview: contentPreview,
          file_data: base64Data, // Store the actual file data
          uploaded_by: currentUser.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          uploader: currentUser
        }

        uploadedFiles.push(uploadedFile)
      }

      onFilesUploaded(uploadedFiles)
      setError(null)
    } catch (err) {
      console.error('Error uploading files:', err)
      setError('Failed to upload files. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFiles(files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-colors
          ${isDragOver 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleFileSelect}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={allowedTypes.join(',')}
          onChange={handleInputChange}
          className="hidden"
        />
        
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
            <Upload className="w-8 h-8 text-gray-600" />
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {uploading ? 'Uploading...' : 'Upload Supporting Files'}
            </h3>
            <p className="text-gray-500 mb-4">
              Drag and drop files here, or click to select files
            </p>
            <div className="text-sm text-gray-400">
              <p>Supported: PDF, Word, Images, Text files</p>
              <p>Max size: {maxFileSize}MB per file</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-red-800">Upload Error</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 mb-1">How it helps</h4>
            <p className="text-sm text-blue-700">
              Upload documents, images, and references that provide context for your project. 
              The AI will use this content to generate more relevant and informed ideas and insights.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FileUpload