"""
FortiFlash API - Video Watermark Remover & Enhancer Backend

This module provides the FastAPI backend for FortiFlash, offering endpoints
for video watermark removal and enhancement.
"""
import os
import shutil
from pathlib import Path
from typing import Dict
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from video_processor import remove_watermark_basic, enhance_video_quality

# Define directories
UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("output")

# Create directories if they don't exist
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

app = FastAPI(
    title="FortiFlash API",
    description="Video Watermark Remover & Enhancer"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Allowed video extensions
ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".wmv", ".flv", ".webm"}


def validate_video_file(filename: str) -> bool:
    """
    Validate if the uploaded file is a video.
    
    Args:
        filename: Name of the uploaded file
        
    Returns:
        True if valid video file, False otherwise
    """
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


def save_upload_file(upload_file: UploadFile, destination: Path) -> None:
    """
    Save uploaded file to destination.
    
    Args:
        upload_file: FastAPI UploadFile object
        destination: Path where file should be saved
    """
    with destination.open("wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)


@app.get("/")
def read_root() -> Dict[str, str]:
    """
    Health check endpoint.
    
    Returns API information including name and version.
    """
    return {
        "message": "FortiFlash - Video Watermark Remover & Enhancer API",
        "version": "1.0.0",
        "status": "running"
    }


@app.post("/upload/")
async def upload_video(file: UploadFile = File(...)) -> Dict[str, str]:
    """
    Upload a video file for processing.
    
    Args:
        file: Video file to upload
        
    Returns:
        Dictionary with upload status and file information
    """
    # Validate file type
    if not validate_video_file(file.filename):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Save uploaded file
    file_path = UPLOAD_DIR / file.filename
    save_upload_file(file, file_path)
    
    return {
        "status": "success",
        "message": "File uploaded successfully",
        "filename": file.filename,
        "size": os.path.getsize(file_path)
    }


@app.post("/remove-watermark/")
async def remove_watermark(file: UploadFile = File(...)) -> Dict[str, str]:
    """
    Remove watermark from uploaded video.
    
    Args:
        file: Video file with watermark
        
    Returns:
        Dictionary with processing status and output file information
    """
    # Validate file type
    if not validate_video_file(file.filename):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Save uploaded file
    input_path = UPLOAD_DIR / file.filename
    save_upload_file(file, input_path)
    
    # Process video to remove watermark
    output_filename = f"nowatermark_{file.filename}"
    output_path = OUTPUT_DIR / output_filename
    
    success = remove_watermark_basic(input_path, output_path)
    
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to process video. Please try again."
        )
    
    return {
        "status": "success",
        "message": "Watermark removal completed",
        "input_filename": file.filename,
        "output_filename": output_filename,
        "download_url": f"/download/{output_filename}"
    }


@app.post("/enhance-video/")
async def enhance_video(file: UploadFile = File(...)) -> Dict[str, str]:
    """
    Enhance video quality.
    
    Args:
        file: Video file to enhance
        
    Returns:
        Dictionary with processing status and output file information
    """
    # Validate file type
    if not validate_video_file(file.filename):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Save uploaded file
    input_path = UPLOAD_DIR / file.filename
    save_upload_file(file, input_path)
    
    # Process video to enhance quality
    output_filename = f"enhanced_{file.filename}"
    output_path = OUTPUT_DIR / output_filename
    
    success = enhance_video_quality(input_path, output_path)
    
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to enhance video. Please try again."
        )
    
    return {
        "status": "success",
        "message": "Video enhancement completed",
        "input_filename": file.filename,
        "output_filename": output_filename,
        "download_url": f"/download/{output_filename}"
    }


@app.get("/download/{filename}")
async def download_file(filename: str) -> FileResponse:
    """
    Download processed video file.
    
    Args:
        filename: Name of the file to download
        
    Returns:
        FileResponse with the requested file
    """
    file_path = OUTPUT_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="video/mp4"
    )
