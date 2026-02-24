import { useEffect, useState } from 'react'
import axios from 'axios'

interface Equipment {
  id?: string
  name: string
  tenant_id: string
  description?: string
}

interface Document {
  id: string
  file_name: string
  content_type: string
  size: number
  embedding_status: string
}

const UnifiedDashboard = () => {
  const [activeStep, setActiveStep] = useState<'equipment' | 'upload' | 'chat'>('equipment')
  const [equipment, setEquipment] = useState<Equipment | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [equipmentName, setEquipmentName] = useState('')
  const [tenantId, setTenantId] = useState('default-tenant')
  const [uploadedFiles, setUploadedFiles] = useState<FileList | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const loadExistingDocuments = async (equipmentId: string) => {
    try {
      const response = await axios.get(`http://localhost:8001/api/v1/equipment/${equipmentId}/documents`)
      const docs = Array.isArray(response.data?.documents) ? response.data.documents : []
      setDocuments(docs)
    } catch (error) {
      console.error('Failed to load existing documents', error)
      setDocuments([])
    }
  }

  useEffect(() => {
    if (equipment?.id) {
      loadExistingDocuments(equipment.id)
    }
  }, [equipment?.id])

  // Equipment Management
  const createEquipment = async () => {
    if (!equipmentName.trim()) {
      setMessage('Please enter equipment name')
      return
    }

    setLoading(true)
    try {
      const response = await axios.post('http://localhost:8001/api/v1/equipment/', {
        name: equipmentName,
        tenant_id: tenantId,
        description: `Equipment for ${equipmentName}`
      })
      
      setEquipment(response.data)
      setMessage('Equipment created successfully!')
      setEquipmentName('')
      setActiveStep('upload')
    } catch (error) {
      setMessage('Failed to create equipment')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Document Upload
  const handleFileUpload = async () => {
    if (!uploadedFiles || uploadedFiles.length === 0) {
      setMessage('Please select files to upload')
      return
    }

    if (!equipment?.id) {
      setMessage('No equipment selected')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      for (let i = 0; i < uploadedFiles.length; i++) {
        formData.append('files', uploadedFiles[i])
      }
      formData.append('description', 'Uploaded via unified dashboard')

      const response = await axios.post(
        `http://localhost:8001/api/v1/equipment/${equipment.id}/documents`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      )

      const uploadedDocs = Array.isArray(response.data?.documents) ? response.data.documents : []
      setDocuments(prev => [...prev, ...uploadedDocs])
      setMessage('Documents uploaded successfully!')
      setUploadedFiles(null)
      setActiveStep('chat')
    } catch (error) {
      setMessage('Failed to upload documents')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const resetFlow = () => {
    setActiveStep('equipment')
    setEquipment(null)
    setDocuments([])
    setEquipmentName('')
    setUploadedFiles(null)
    setMessage('')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Voice AI Knowledge Base Setup
          </h1>
          <p className="text-gray-600">
            Create knowledge bases, upload documents, and start chatting with AI
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className={`flex items-center ${activeStep === 'equipment' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeStep === 'equipment' ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                1
              </div>
              <span className="ml-2 font-medium">Knowledge Base</span>
            </div>
            <div className={`flex-1 h-1 mx-4 ${equipment ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            <div className={`flex items-center ${activeStep === 'upload' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeStep === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                2
              </div>
              <span className="ml-2 font-medium">Upload</span>
            </div>
            <div className={`flex-1 h-1 mx-4 ${documents.length > 0 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            <div className={`flex items-center ${activeStep === 'chat' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeStep === 'chat' ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                3
              </div>
              <span className="ml-2 font-medium">Chat</span>
            </div>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-md ${message.includes('success') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message}
          </div>
        )}

        {/* Step 1: Knowledge Base Creation */}
        {activeStep === 'equipment' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Step 1: Create Knowledge Base</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Knowledge Base Name
                </label>
                <input
                  type="text"
                  value={equipmentName}
                  onChange={(e) => setEquipmentName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter knowledge base name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tenant ID
                </label>
                <input
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter tenant ID"
                />
              </div>
              <button
                onClick={createEquipment}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Creating...' : 'Create Knowledge Base'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Document Upload */}
        {activeStep === 'upload' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Step 2: Upload Documents</h2>
            {equipment && (
              <div className="mb-4 p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-800">
                  Knowledge Base: <strong>{equipment.name}</strong>
                </p>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Files (PDF, DOCX, TXT)
                </label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(e) => setUploadedFiles(e.target.files)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {uploadedFiles && uploadedFiles.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-700">
                    Selected files: {uploadedFiles.length}
                  </p>
                  <ul className="mt-2 text-sm text-gray-600">
                    {Array.from(uploadedFiles).map((file, index) => (
                      <li key={index}>• {file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {documents.length > 0 && (
                <div className="p-3 bg-green-50 rounded-md">
                  <p className="text-sm font-medium text-green-800">Existing documents:</p>
                  <ul className="mt-2 text-sm text-green-900 space-y-1">
                    {documents.map((doc, index) => (
                      <li key={doc.id || String(index)}>• {doc.file_name}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-green-700">You can proceed to chat without uploading another file.</p>
                </div>
              )}
              <div className="flex space-x-4">
                <button
                  onClick={handleFileUpload}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? 'Uploading...' : 'Upload Documents'}
                </button>
                <button
                  onClick={() => setActiveStep('equipment')}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300"
                >
                  Back
                </button>
              </div>
              {documents.length > 0 && (
                <button
                  onClick={() => setActiveStep('chat')}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
                >
                  Proceed to Chat
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Chat Interface */}
        {activeStep === 'chat' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Step 3: Start Chatting</h2>
            {equipment && (
              <div className="mb-4 p-3 bg-green-50 rounded-md">
                <p className="text-sm text-green-800">
                  Knowledge Base: <strong>{equipment.name}</strong>
                </p>
                <p className="text-sm text-green-800">
                  Documents uploaded: <strong>{documents.length}</strong>
                </p>
              </div>
            )}
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-md">
                <h3 className="font-medium mb-2">Chat Options:</h3>
                <div className="space-y-2">
                  <a
                    href={`/stream?equipment_id=${equipment?.id}&tenant_id=${equipment?.tenant_id}&prompt_type=call_center`}
                    className="block w-full text-left bg-blue-600 text-white p-3 rounded-md hover:bg-blue-700"
                  >
                    📞 Call Center Assistant
                  </a>
                  <a
                    href={`/stream?equipment_id=${equipment?.id}&tenant_id=${equipment?.tenant_id}&prompt_type=document_qna`}
                    className="block w-full text-left bg-green-600 text-white p-3 rounded-md hover:bg-green-700"
                  >
                    📚 Document Q&A
                  </a>
                  <a
                    href={`/stream?equipment_id=${equipment?.id}&tenant_id=${equipment?.tenant_id}&prompt_type=technical`}
                    className="block w-full text-left bg-orange-600 text-white p-3 rounded-md hover:bg-orange-700"
                  >
                    🔧 Technical Support
                  </a>
                </div>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={resetFlow}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300"
                >
                  Start New Setup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default UnifiedDashboard
