import { useState, useRef } from 'react'
import { Upload, X, FileText, AlertCircle } from 'lucide-react'
import { ProjectFile, Project } from '../types'
import { logger } from '../utils/logger'
import { FileService } from '../lib/fileService'
import { getCurrentUser } from '../lib/supabase'
// Dynamic import for PDF.js to avoid SSR issues
let pdfjsLib: any = null

// Lazy load PDF.js only when needed
const loadPdfJs = async () => {
  if (!pdfjsLib && typeof window !== 'undefined') {
    try {
      // Import pdfjs-dist with multiple fallback strategies
      logger.debug('🔍 Attempting to import pdfjs-dist...')

      // Strategy 1: Try namespace import (* as)
      const module = await import('pdfjs-dist')

      logger.debug('📦 Module structure:', {
        moduleType: typeof module,
        moduleConstructor: module?.constructor?.name,
        moduleKeys: Object.keys(module).slice(0, 15),
        hasDefault: 'default' in module,
        defaultType: typeof module.default,
        defaultConstructor: module.default?.constructor?.name,
        defaultKeys: module.default ? Object.keys(module.default).slice(0, 15) : null
      })

      // Try multiple access patterns
      pdfjsLib = module.default || module || (module as any).pdfjs || (window as any).pdfjsLib

      logger.debug('🎯 pdfjsLib resolved:', {
        exists: !!pdfjsLib,
        type: typeof pdfjsLib,
        constructor: pdfjsLib?.constructor?.name,
        keys: pdfjsLib ? Object.keys(pdfjsLib).slice(0, 15) : null,
        hasGlobalWorkerOptions: pdfjsLib && ('GlobalWorkerOptions' in pdfjsLib),
        hasGetDocument: pdfjsLib && ('getDocument' in pdfjsLib),
        // Check prototype chain
        protoKeys: pdfjsLib ? Object.keys(Object.getPrototypeOf(pdfjsLib)).slice(0, 10) : null
      })

      if (!pdfjsLib || typeof pdfjsLib !== 'object') {
        throw new Error(`PDF.js import failed: resolved to ${typeof pdfjsLib}. Module dump: ${JSON.stringify({
          moduleKeys: Object.keys(module),
          hasDefault: !!module.default,
          windowPdfjsLib: typeof (window as any).pdfjsLib
        })}`)
      }

      // Check for required exports
      const hasGlobalWorkerOptions = 'GlobalWorkerOptions' in pdfjsLib
      const hasGetDocument = 'getDocument' in pdfjsLib

      if (!hasGlobalWorkerOptions || !hasGetDocument) {
        const diagnostic = {
          availableKeys: Object.keys(pdfjsLib).slice(0, 20),
          prototypeKeys: Object.keys(Object.getPrototypeOf(pdfjsLib)).slice(0, 10),
          ownPropertyNames: Object.getOwnPropertyNames(pdfjsLib).slice(0, 20),
          hasGlobalWorkerOptions,
          hasGetDocument
        }
        throw new Error(`PDF.js missing exports. Diagnostic: ${JSON.stringify(diagnostic, null, 2)}`)
      }

      // Configure worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`

      logger.debug('✅ PDF.js loaded successfully')
    } catch (_error) {
      logger.error('❌ Failed to load PDF.js:', error)
      throw error
    }
  }
  return pdfjsLib
}

interface FileUploadProps {
  currentProject: Project
  onFilesUploaded: (files: ProjectFile[]) => void
  maxFileSize?: number // in MB, default 10MB
  allowedTypes?: string[] // MIME types
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  currentProject, 
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

  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      logger.debug('🔄 Starting PDF text extraction for:', file.name)
      const arrayBuffer = await file.arrayBuffer()

      // Load PDF.js dynamically
      const pdfjs = await loadPdfJs()
      if (!pdfjs) {
        throw new Error('Failed to load PDF.js library')
      }

      // Simple PDF.js 2.x document loading
      const pdf = await pdfjs.getDocument({
        data: arrayBuffer,
        verbosity: 0 // Suppress PDF.js warnings
      }).promise
      
      let fullText = ''
      
      // Extract text from all pages (limit to first 10 pages for performance)
      const maxPages = Math.min(pdf.numPages, 10)
      logger.debug(`📄 Extracting text from ${maxPages} pages of PDF`)
      
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum)
          const textContent = await page.getTextContent()
          const pageText = textContent.items.map((item: any) => item.str).join(' ')
          fullText += pageText + '\n'
          logger.debug(`✅ Extracted page ${pageNum}: ${pageText.length} characters`)
        } catch (pageError) {
          logger.warn(`⚠️ Could not extract text from page ${pageNum}:`, pageError)
          continue
        }
      }
      
      const extractedText = fullText.trim()
      if (extractedText) {
        logger.debug(`🎉 Successfully extracted ${extractedText.length} characters from PDF`)
        return extractedText
      } else {
        logger.warn('📄 PDF processed but no text content found')
        return `[PDF document: ${file.name} - PDF contains no extractable text, but file uploaded successfully for AI reference]`
      }
      
    } catch (_error) {
      logger.warn('❌ Could not extract text from PDF:', error)
      return `[PDF document: ${file.name} - PDF text extraction not available, but file uploaded successfully for AI reference]`
    }
  }

  const readFileContent = async (file: File): Promise<string | undefined> => {
    try {
      // Extract content from text-based files
      if (file.type === 'text/plain' || file.type === 'text/markdown') {
        return await file.text()
      }
      
      // Extract text from PDF files
      if (file.type === 'application/pdf') {
        const pdfText = await extractTextFromPDF(file)
        return pdfText || undefined
      }
      
      // For Word documents, we can't easily extract text in the browser
      // But we can provide a helpful message
      if (file.type === 'application/msword' || 
          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return `[Word document: ${file.name} - Content will be available to AI but cannot be previewed in browser]`
      }
      
    } catch (_error) {
      logger.warn('Could not read file content:', error)
    }
    
    return undefined
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
      
      // Get current user for backend upload
      const currentUser = await getCurrentUser()
      const uploadedBy = currentUser?.id

      for (const file of validFiles) {
        logger.debug(`🔄 Processing file: ${file.name} (${file.type})`)
        
        // Read content preview for text files and AI analysis
        const contentPreview = await readFileContent(file)
        
        if (contentPreview) {
          logger.debug(`✅ Extracted ${contentPreview.length} characters from ${file.name}`)
          logger.debug(`📝 Content preview: "${contentPreview.substring(0, 100).replace(/\n/g, ' ')}${contentPreview.length > 100 ? '...' : ''}"`)
        } else {
          logger.debug(`ℹ️ No text content extracted from ${file.name} (${file.type})`)
        }
        
        // Upload file to Supabase Storage and save metadata
        const uploadResult = await FileService.uploadFile(
          file,
          currentProject.id,
          contentPreview || '',
          uploadedBy
        )

        if (uploadResult.success && uploadResult.file) {
          uploadedFiles.push(uploadResult.file)
          logger.debug(`✅ Successfully uploaded: ${file.name}`)
        } else {
          logger.error(`❌ Failed to upload ${file.name}:`, uploadResult.error)
          setError(`Failed to upload "${file.name}": ${uploadResult.error}`)
          setUploading(false)
          return
        }
      }

      logger.debug(`🎉 All files uploaded successfully: ${uploadedFiles.length} files`)
      onFilesUploaded(uploadedFiles)
      setError(null)
    } catch (_err) {
      logger.error('Error uploading files:', err)
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
              Text content from PDFs, documents, and text files will be automatically extracted and analyzed by the AI 
              to generate more relevant and informed ideas and insights.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FileUpload