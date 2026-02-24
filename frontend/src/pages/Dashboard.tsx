import { useState, useEffect } from 'react'
import { Equipment, Document } from '@/types'
import { EquipmentManager } from '@/components/EquipmentManager'
import { DocumentUploader } from '@/components/DocumentUploader'
import { UnifiedChat } from '@/components/UnifiedChat'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Upload, MessageSquare, Settings, Plus } from 'lucide-react'

const Dashboard = () => {
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [activeTab, setActiveTab] = useState('equipment')

  const handleEquipmentSelect = (equipment: Equipment) => {
    setSelectedEquipment(equipment)
    setActiveTab('documents')
  }

  const handleDocumentsUploaded = (uploadedDocs: Document[]) => {
    setDocuments(prev => [...prev, ...uploadedDocs])
    if (uploadedDocs.length > 0) {
      setActiveTab('chat')
    }
  }

  const handleChatStart = () => {
    if (selectedEquipment) {
      setActiveTab('chat')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Voice AI Knowledge Base
          </h1>
          <p className="text-slate-600">
            Manage equipment, upload documents, and chat with AI assistants
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Equipment</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{selectedEquipment ? '1 Selected' : 'None'}</div>
              <p className="text-xs text-muted-foreground">
                {selectedEquipment ? selectedEquipment.name : 'Select equipment to begin'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Documents</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{documents.length}</div>
              <p className="text-xs text-muted-foreground">
                {documents.length > 0 ? 'Documents uploaded' : 'No documents yet'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chat Status</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {selectedEquipment && documents.length > 0 ? 'Ready' : 'Setup Required'}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedEquipment && documents.length > 0 
                  ? 'Start chatting now' 
                  : 'Complete setup first'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="equipment" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Equipment
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2" disabled={!selectedEquipment}>
              <Upload className="h-4 w-4" />
              Documents
              {selectedEquipment && <Badge variant="secondary" className="ml-1">2</Badge>}
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-2" disabled={!selectedEquipment || documents.length === 0}>
              <MessageSquare className="h-4 w-4" />
              Chat
              {selectedEquipment && documents.length > 0 && <Badge variant="secondary" className="ml-1">3</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="equipment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Equipment Management</CardTitle>
                <CardDescription>
                  Select or create equipment for your knowledge base
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EquipmentManager onEquipmentSelect={handleEquipmentSelect} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Document Upload</CardTitle>
                <CardDescription>
                  Upload PDF, DOCX, or text files to build your knowledge base
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedEquipment ? (
                  <DocumentUploader 
                    equipmentId={selectedEquipment.id!}
                    tenantId={selectedEquipment.tenant_id}
                    onDocumentsUploaded={handleDocumentsUploaded}
                  />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Please select equipment first</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Chat Interface</CardTitle>
                <CardDescription>
                  Chat with your AI assistant using the uploaded knowledge base
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedEquipment && documents.length > 0 ? (
                  <UnifiedChat 
                    equipment={selectedEquipment}
                    documents={documents}
                  />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-2">
                      {!selectedEquipment ? 'Please select equipment first' : 'Please upload documents first'}
                    </p>
                    {!selectedEquipment && (
                      <Button onClick={() => setActiveTab('equipment')} className="mt-4">
                        Select Equipment
                      </Button>
                    )}
                    {selectedEquipment && documents.length === 0 && (
                      <Button onClick={() => setActiveTab('documents')} className="mt-4">
                        Upload Documents
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default Dashboard
