#!/bin/bash
# Dependency Initialization Script
# Run this after sandbox resets to install required Python packages

echo "🔧 Initializing Analytics Dashboard dependencies..."

# Check if python-docx is installed
if ! python3.11 -c "from docx import Document" 2>/dev/null; then
    echo "📦 Installing python-docx..."
    sudo pip3 install python-docx --quiet
    echo "✅ python-docx installed"
else
    echo "✅ python-docx already installed"
fi

# Check if openpyxl is installed
if ! python3.11 -c "import openpyxl" 2>/dev/null; then
    echo "📦 Installing openpyxl..."
    sudo pip3 install openpyxl --quiet
    echo "✅ openpyxl installed"
else
    echo "✅ openpyxl already installed"
fi

# Verify Google Drive rclone config exists
if [ ! -f /home/ubuntu/.gdrive-rclone.ini ]; then
    echo "⚠️  WARNING: Google Drive rclone config not found at /home/ubuntu/.gdrive-rclone.ini"
    echo "   Sync scripts will fail without this configuration"
    exit 1
else
    echo "✅ Google Drive rclone config found"
fi

echo "✅ All dependencies initialized successfully!"
