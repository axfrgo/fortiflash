import React, { useState } from 'react';
import './App.css';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const API_URL = 'http://127.0.0.1:8000';

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const processVideo = async (endpoint) => {
    if (!selectedFile) {
      setError('Please select a video file first');
      return;
    }

    setProcessing(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.detail || 'An error occurred');
      }
    } catch (err) {
      setError('Failed to connect to server. Make sure the backend is running.');
    } finally {
      setProcessing(false);
    }
  };

  const downloadFile = (filename) => {
    window.open(`${API_URL}/download/${filename}`, '_blank');
  };

  return (
    <div className="App">
      <header className="header">
        <h1>⚡ FortiFlash</h1>
        <p className="subtitle">Video Watermark Remover & Enhancer</p>
      </header>

      <main className="main-content">
        <div 
          className={`upload-area ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="upload-icon">📹</div>
          <p className="upload-text">
            {selectedFile ? selectedFile.name : 'Drag & drop your video here'}
          </p>
          <p className="upload-subtext">or</p>
          <label htmlFor="file-upload" className="file-label">
            Choose File
          </label>
          <input
            id="file-upload"
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <p className="supported-formats">
            Supported: MP4, AVI, MOV, MKV, WMV, FLV, WebM
          </p>
        </div>

        {selectedFile && (
          <div className="action-buttons">
            <button 
              className="btn btn-primary"
              onClick={() => processVideo('/remove-watermark/')}
              disabled={processing}
            >
              {processing ? '🔄 Processing...' : '🗑️ Remove Watermark'}
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => processVideo('/enhance-video/')}
              disabled={processing}
            >
              {processing ? '🔄 Processing...' : '✨ Enhance Video'}
            </button>
          </div>
        )}

        {error && (
          <div className="message error-message">
            ❌ {error}
          </div>
        )}

        {result && (
          <div className="message success-message">
            <p>✅ {result.message}</p>
            <p className="result-details">
              Input: {result.input_filename}
            </p>
            <button 
              className="btn btn-download"
              onClick={() => downloadFile(result.output_filename)}
            >
              ⬇️ Download {result.output_filename}
            </button>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>FortiFlash v1.0.0 | Powered by AI</p>
      </footer>
    </div>
  );
}

export default App;
