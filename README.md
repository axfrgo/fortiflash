# FortiFlash

**FortiFlash** is a powerful web application for video watermark removal and enhancement. Built with modern technologies, FortiFlash provides an intuitive interface for processing videos with professional results.

Inspired by advanced video processing techniques, FortiFlash offers:
- AI-powered watermark removal
- Video quality enhancement
- User-friendly web interface
- Fast backend processing

## Tech Stack

### Backend
- **Python 3.11+**
- **FastAPI** - Modern web framework for building APIs
- **Uvicorn** - ASGI server
- Video processing libraries (to be integrated)

### Frontend
- **React 18** - User interface library
- **Create React App** - Build tooling

## Project Structure
```
fortiflash/
├── backend/          # FastAPI backend
│   ├── main.py       # API endpoints
│   ├── requirements.txt
│   └── README.md
├── frontend/         # React frontend
│   ├── src/
│   │   ├── App.js    # Main application component
│   │   └── index.js  # Entry point
│   ├── public/
│   └── package.json
└── README.md
```

## Setup & Installation

### Prerequisites
- Python 3.11 or higher
- Node.js 16+ and npm
- At least 500MB free disk space for dependencies

### Backend Setup
1. Navigate to backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
   **Note:** If you encounter disk space issues, free up space and run the install again.
   
3. Run the backend server:
   ```bash
   uvicorn main:app --reload
   ```
   Backend will be available at: http://127.0.0.1:8000

### Frontend Setup
1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the frontend development server:
   ```bash
   npm start
   ```
   Frontend will be available at: http://localhost:3000

## Using VS Code Tasks
This project includes pre-configured tasks for easy launching:
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "Tasks: Run Task"
3. Select either:
   - **Start Backend Server** - Launches FastAPI backend
   - **Start Frontend Server** - Launches React frontend

## API Endpoints

### Backend API
- `GET /` - Health check and API information
- `POST /remove-watermark/` - Upload video to remove watermark
- `POST /enhance-video/` - Upload video to enhance quality

## Features

### Current ✅
- Full-stack web application with FastAPI + React
- Drag-and-drop file upload interface
- Beautiful gradient UI with animations
- File validation and error handling
- API endpoints for video processing
- Download processed videos
- Hot-reload development environment
- Type-safe code with proper documentation

### Video Processing Capabilities 🎬
- **Watermark Removal**: Uses OpenCV-based inpainting (ready to integrate ML models)
- **Video Enhancement**: 
  - Noise reduction using fastNlMeansDenoising
  - Contrast enhancement with CLAHE
  - Sharpening filters
  - Frame-by-frame processing

### Roadmap 🚀
- [ ] Install video processing libraries (opencv-python, numpy)
- [ ] Integrate advanced ML models for watermark detection
- [ ] Add batch processing support
- [ ] Real-time progress tracking with WebSockets
- [ ] Format conversion options (MP4, AVI, MOV, etc.)
- [ ] Video preview before/after comparison
- [ ] Cloud storage integration
- [ ] User authentication and history

## Development Notes
- Backend runs on port 8000
- Frontend runs on port 3000
- CORS is enabled for local development
- Both servers support hot-reload during development

## License
MIT License - Feel free to use and modify for your needs.
