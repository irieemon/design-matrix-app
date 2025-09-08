import { useState, useEffect } from 'react'
import { Upload, FolderOpen } from 'lucide-react'
import { ProjectFile, User, Project } from '../types'
import FileUpload from './FileUpload'
import FileManager from './FileManager'
import FileViewer from './FileViewer'

interface ProjectFilesProps {
  currentProject: Project
  currentUser: User
  files: ProjectFile[]
  onFilesUploaded: (files: ProjectFile[]) => void
  onDeleteFile: (fileId: string) => void
  isEmbedded?: boolean
}

const ProjectFiles: React.FC<ProjectFilesProps> = ({ 
  currentProject, 
  currentUser,
  files,
  onFilesUploaded,
  onDeleteFile,
  isEmbedded = false
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'manage'>('upload')
  const [viewingFile, setViewingFile] = useState<ProjectFile | null>(null)

  // Auto-switch to manage tab if files exist
  useEffect(() => {
    if (files.length > 0 && activeTab === 'upload') {
      setActiveTab('manage')
    }
  }, [files.length, activeTab])

  const handleFilesUploaded = (newFiles: ProjectFile[]) => {
    onFilesUploaded(newFiles)
    // Switch to manage tab to show the uploaded files
    setActiveTab('manage')
    console.log('Files uploaded:', newFiles)
  }

  const handleDeleteFile = (fileId: string) => {
    onDeleteFile(fileId)
    console.log('File deleted:', fileId)
  }

  const handleViewFile = (file: ProjectFile) => {
    setViewingFile(file)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {isEmbedded ? 'Supporting Files' : 'File Management'}
          </h2>
          <p className="text-slate-500 mt-1">
            {isEmbedded 
              ? 'Upload documents and resources to enhance AI-generated ideas and insights'
              : 'Upload, organize, and manage all project files and supporting documents'
            }
          </p>
        </div>
        <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('upload')}
            className={`
              flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
              ${activeTab === 'upload' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
              }
            `}
          >
            <Upload className="w-4 h-4" />
            <span>Upload</span>
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`
              flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
              ${activeTab === 'manage' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
              }
            `}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Manage ({files.length})</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'upload' ? (
          <FileUpload
            currentProject={currentProject}
            currentUser={currentUser}
            onFilesUploaded={handleFilesUploaded}
          />
        ) : (
          <FileManager
            files={files}
            onDeleteFile={handleDeleteFile}
            onViewFile={handleViewFile}
          />
        )}
      </div>

      {/* File Viewer Modal */}
      <FileViewer
        file={viewingFile}
        isOpen={!!viewingFile}
        onClose={() => setViewingFile(null)}
      />
    </div>
  )
}

export default ProjectFiles