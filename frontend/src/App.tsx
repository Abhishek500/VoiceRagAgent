import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Stream from './pages/Stream'
import UnifiedDashboard from './pages/UnifiedDashboard'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UnifiedDashboard />} />
        <Route path="/dashboard" element={<UnifiedDashboard />} />
        <Route path="/stream" element={<Stream />} />
        <Route path="/chat" element={<Stream />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

