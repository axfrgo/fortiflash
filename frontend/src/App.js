import React, { useState, useRef, useEffect } from 'react';
import './App.css';

// PKCE helper functions
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

function base64URLEncode(array) {
  return btoa(String.fromCharCode.apply(null, array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(digest));
}

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [mode, setMode] = useState('remove');
  // simple user-friendly presets: fast, balanced, quality (default)
  const [preset, setPreset] = useState('quality');
  const [hfToken, setHfToken] = useState(localStorage.getItem('hf_token') || null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [bboxCoords, setBboxCoords] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const drawingRef = useRef({dragging:false, startX:0, startY:0});
  const baseImageRef = useRef(null);
  const lastObjectUrlRef = useRef(null);

  // API URL resolution order:
  // 1. REACT_APP_API_URL (set in Vercel environment variables for production)
  // 2. If running on localhost, use the local backend
  // 3. Otherwise assume the backend is served from the same origin
  const API_URL = (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== '')
    ? process.env.REACT_APP_API_URL
    : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://127.0.0.1:8001'
      : window.location.origin;

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      const codeVerifier = sessionStorage.getItem('hf_code_verifier');
      if (!codeVerifier) {
        alert('Missing code verifier. Please try signing in again.');
        return;
      }
      const redirectUri = window.location.origin;
      // Exchange code for token via backend (include code_verifier and the redirect_uri actually used)
      (async () => {
        try {
          const exchangeUrl = `${API_URL}/exchange-token`;
          console.log('Exchanging token at', exchangeUrl, 'with redirect_uri', redirectUri);
          const res = await fetch(exchangeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ code, code_verifier: codeVerifier, redirect_uri: redirectUri })
          });

          const ct = res.headers.get('content-type') || '';
          let data = null;
          if (ct.includes('application/json')) {
            data = await res.json();
          } else {
            // non-JSON response (likely HTML index or error page) — capture text for debugging
            const text = await res.text();
            console.warn('Non-JSON response from /exchange-token:', text.slice(0, 500));
            // try to parse JSON from text if possible, otherwise wrap
            try {
              data = JSON.parse(text);
            } catch (e) {
              data = { detail: text };
            }
          }

          if (res.ok && data && data.access_token) {
            localStorage.setItem('hf_token', data.access_token);
            setHfToken(data.access_token);
            window.history.replaceState({}, document.title, window.location.pathname); // Clean URL
            alert('Successfully signed in with Hugging Face!');
          } else {
            const errMsg = (data && (data.detail || data.error || JSON.stringify(data))) || 'Unknown error';
            alert('Failed to sign in: ' + errMsg);
            setError('Failed to sign in: ' + errMsg);
          }
        } catch (err) {
          console.error('Error exchanging token (fetch failed):', err);
          alert('Error exchanging token: ' + err.message);
          setError('Error exchanging token: ' + err.message);
        }
      })();
    }
  }, [API_URL]);

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
    const files = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files : null;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      setBboxCoords(null);
      baseImageRef.current = null;
    }
  };

  const handleFileChange = (e) => {
    const files = e.target && e.target.files ? e.target.files : null;
    if (!files || files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setBboxCoords(null);
    baseImageRef.current = null;
    // small delay to allow file input to settle before extracting first frame
    setTimeout(() => handleLoadFirstFrame(), 50);
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
    // include bbox if drawn (send as 'x,y,w,h')
    if (bboxCoords) {
      const { x, y, w, h } = bboxCoords;
      formData.append('bbox', `${x},${y},${w},${h}`);
    }
  formData.append('mode', mode);
  // send preset (backend maps to internal numeric tuning)
  formData.append('preset', preset);
  // send HF token if available
  if (hfToken) {
    formData.append('hf_token', hfToken);
  }
    // include confirm flag
    formData.append('confirm', 'true');

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

  const handleHfSignIn = async () => {
    const clientId = process.env.REACT_APP_CLIENT_ID || '001a9fe3-a33a-4249-82e6-9dea26f8bd79'; // Prefer env-provided client id
    const redirectUri = window.location.origin; // use runtime origin so auth and token exchange match
    const scope = 'inference-api'; // Correct HF scope required for API access

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store code_verifier and redirect_uri for later use in token exchange
    sessionStorage.setItem('hf_code_verifier', codeVerifier);
    sessionStorage.setItem('hf_redirect_uri', redirectUri);

    const authUrl = `https://huggingface.co/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&code_challenge=${codeChallenge}&code_challenge_method=S256`;
    window.location.href = authUrl;
  };

  // progress polling while processing
  useEffect(() => {
    let timer = null;
    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/static/cpu_object_removal_cache/progress.json`);
        if (!res.ok) return;
        const js = await res.json();
        // show a tiny inline status when processing
        if (js && js.stage) {
          setError(null);
          setResult(prev => ({...prev, progress: js}));
        }
      } catch (e) {
        // ignore
      }
    };
    if (processing) {
      timer = setInterval(poll, 1000);
      poll();
    }
    return () => { if (timer) clearInterval(timer); };
  }, [processing]);

  const handleLoadFirstFrame = () => {
    if (!selectedFile) return;

    // Try server-side extraction first (handles browser codec limitations)
    const form = new FormData();
    form.append('file', selectedFile);
    fetch(`${API_URL}/first-frame/`, { method: 'POST', body: form })
      .then(res => {
        if (!res.ok) throw new Error('server first-frame failed');
        return res.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) {
            URL.revokeObjectURL(url);
            return;
          }
          canvas.width = img.naturalWidth || canvas.width;
          canvas.height = img.naturalHeight || canvas.height;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0,0,canvas.width,canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          try { baseImageRef.current = canvas.toDataURL(); } catch (e) { baseImageRef.current = null; }
          URL.revokeObjectURL(url);
        };
        img.src = url;
      })
      .catch(() => {
        // fallback: decode in-browser (may fail for unsupported codecs)
        try {
          if (lastObjectUrlRef.current) URL.revokeObjectURL(lastObjectUrlRef.current);
        } catch (e) {}
        const url = URL.createObjectURL(selectedFile);
        lastObjectUrlRef.current = url;
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = url;
        video.muted = true;
        const onLoadedData = () => {
          const canvas = canvasRef.current;
          if (!canvas) {
            try { URL.revokeObjectURL(url); } catch (e) {}
            return;
          }
          canvas.width = video.videoWidth || canvas.width;
          canvas.height = video.videoHeight || canvas.height;
          const ctx = canvas.getContext('2d');
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            baseImageRef.current = canvas.toDataURL();
          } catch (e) {
            setTimeout(() => {
              try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                baseImageRef.current = canvas.toDataURL();
              } catch (err) {
                baseImageRef.current = null;
              }
            }, 200);
          }
          video.removeEventListener('loadeddata', onLoadedData);
          try { URL.revokeObjectURL(url); } catch (e) {}
          lastObjectUrlRef.current = null;
        };
        video.addEventListener('loadeddata', onLoadedData);
      });
  };

  // auto-load first frame when a file is selected
  useEffect(() => {
    if (selectedFile) {
      // give the file selection a short moment to settle
      setTimeout(() => handleLoadFirstFrame(), 50);
    }
    return () => {
      // cleanup object URL if component unmounts or file changes
      try { if (lastObjectUrlRef.current) URL.revokeObjectURL(lastObjectUrlRef.current); } catch (e) {}
      lastObjectUrlRef.current = null;
    };
  }, [selectedFile]);

  const startDraw = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    drawingRef.current = {dragging:true, startX:x, startY:y};
  };

  const drawMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !drawingRef.current.dragging) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    const sx = drawingRef.current.startX;
    const sy = drawingRef.current.startY;
    const w = Math.abs(x - sx);
    const h = Math.abs(y - sy);
    const rx = Math.min(x, sx);
    const ry = Math.min(y, sy);
    const ctx = canvas.getContext('2d');
    // redraw original frame from stored base image (or preserve current canvas)
    if (baseImageRef.current) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(255,0,0,0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(rx, ry, w, h);
      };
      img.src = baseImageRef.current;
    } else {
      // fallback: stroke on existing canvas
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.strokeStyle = 'rgba(255,0,0,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, w, h);
    }
  };

  const endDraw = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !drawingRef.current.dragging) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    const sx = drawingRef.current.startX;
    const sy = drawingRef.current.startY;
    const w = Math.abs(x - sx);
    const h = Math.abs(y - sy);
    const rx = Math.min(x, sx);
    const ry = Math.min(y, sy);
    setBboxCoords({ x: rx, y: ry, w, h });
    drawingRef.current.dragging = false;
  };

  const downloadFile = (filename) => {
    window.open(`${API_URL}/download/${filename}`, '_blank');
  };

  const togglePreview = () => {
    setShowPreview(!showPreview);
  };

  return (
    <div className="App">
      <header className="header">
        <h1>⚡</h1>
        <p className="subtitle">Video Watermark Remover</p>
        <div className="auth-section">
          {hfToken ? (
            <span>✅ Signed in with Hugging Face</span>
          ) : (
            <button className="btn" onClick={handleHfSignIn}>🔑 Sign in with Hugging Face (Enable AI)</button>
          )}
        </div>
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
            <div className="bbox-ui">
              <p>Draw bounding box on first frame (optional):</p>
              <div style={{marginBottom:8}}>
                <label style={{marginRight:8}}>Mode:</label>
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="remove">Remove (per-frame)</option>
                  <option value="collage">Collage (single inpaint)</option>
                </select>
                <label style={{marginLeft:12, marginRight:6}}>Preset</label>
                <select value={preset} onChange={(e) => setPreset(e.target.value)}>
                  <option value="fast">Fast (faster processing)</option>
                  <option value="balanced">Balanced (good speed & quality)</option>
                  <option value="quality">Quality (best visual result)</option>
                  <option value="ai">AI (Hugging Face, if signed in)</option>
                </select>
              </div>
              <canvas ref={canvasRef} onMouseDown={startDraw} onMouseMove={drawMove} onMouseUp={endDraw} width={640} height={360} style={{border:'1px solid #ccc', maxWidth: '100%'}} />
              <div style={{marginTop:8}}>
                <button className="btn" onClick={handleLoadFirstFrame}>Load First Frame</button>
                {bboxCoords && (<span style={{marginLeft:12}}>BBox: {bboxCoords.x},{bboxCoords.y},{bboxCoords.w},{bboxCoords.h}</span>)}
              </div>
            </div>

            <button 
              className="btn btn-primary"
              onClick={() => processVideo('/remove-watermark/')}
              disabled={processing}
            >
              {processing ? '🔄 Processing...' : '🎯 Remove Moving Logo'}
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
              Input: {result.input_filename}<br/>
              Output: {result.output_filename}
            </p>
            
            <div className="action-buttons">
              <button 
                className="btn btn-preview"
                onClick={togglePreview}
              >
                {showPreview ? '🙈 Hide Preview' : '👁️ Preview Video'}
              </button>
              <button 
                className="btn btn-download"
                onClick={() => downloadFile(result.output_filename)}
              >
                ⬇️ Download Video
              </button>
            </div>

            {showPreview && result.stream_url && (
              <div className="video-preview">
                <h3>📺 Video Preview</h3>
                <div className="video-container">
                  <video 
                    controls 
                    width="100%" 
                    style={{ maxWidth: '800px', maxHeight: '600px' }}
                    preload="metadata"
                  >
                    <source src={`${API_URL}${result.stream_url}`} type="video/mp4" />
                    <source src={`${API_URL}${result.preview_url}`} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                  <p className="video-info">
                    🎬 Click play to preview your processed video before downloading
                  </p>
                </div>
              </div>
            )}
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
