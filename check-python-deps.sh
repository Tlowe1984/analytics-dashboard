#!/bin/bash
# Automatic Python Dependency Checker and Installer
# Runs on every server startup to ensure Python packages are available
# This prevents sync failures due to sandbox resets
#
# CRITICAL: Installs to BOTH Python 3.11 AND UV Python 3.13
# because different parts of the system use different Python versions

echo "🔍 Checking Python dependencies..."

# List of Python executables to check and install packages for
PYTHON_EXES=(
    "/usr/bin/python3.11"
    "/home/ubuntu/.local/share/uv/python/cpython-3.13.8-linux-x86_64-gnu/bin/python3"
)

# Required packages
PACKAGES=("docx:python-docx" "openpyxl:openpyxl")

# Track overall status
OVERALL_SUCCESS=true

# Process each Python installation
for PYTHON_EXE in "${PYTHON_EXES[@]}"; do
    if [ ! -f "$PYTHON_EXE" ]; then
        echo "⏭️  Skipping $PYTHON_EXE (not found)"
        continue
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Checking: $($PYTHON_EXE --version 2>&1)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Check if core Python modules work
    if ! $PYTHON_EXE -c "import json, _contextvars, _decimal" 2>/dev/null; then
        echo "⚠️  Python core modules corrupted - forcing full reinstall"
        FORCE_REINSTALL=true
    else
        FORCE_REINSTALL=false
    fi
    
    # Check each package
    MISSING=()
    for PKG in "${PACKAGES[@]}"; do
        IFS=':' read -r IMPORT_NAME INSTALL_NAME <<< "$PKG"
        if ! $PYTHON_EXE -c "import $IMPORT_NAME" 2>/dev/null; then
            echo "❌ Missing: $INSTALL_NAME"
            MISSING+=("$INSTALL_NAME")
        else
            echo "✅ Found: $INSTALL_NAME"
        fi
    done
    
    # Install missing or force reinstall if Python core is corrupted
    if [ ${#MISSING[@]} -gt 0 ] || [ "$FORCE_REINSTALL" = true ]; then
        if [ "$FORCE_REINSTALL" = true ]; then
            echo "📦 Force reinstalling all packages due to Python corruption"
            INSTALL_PACKAGES=("python-docx" "openpyxl")
        else
            echo "📦 Installing missing packages: ${MISSING[*]}"
            INSTALL_PACKAGES=("${MISSING[@]}")
        fi
        
        # Determine pip install flags based on Python version
        if [[ "$PYTHON_EXE" == *"uv/python"* ]]; then
            # UV Python requires --break-system-packages
            sudo $PYTHON_EXE -m pip install --quiet --break-system-packages --force-reinstall --no-cache-dir "${INSTALL_PACKAGES[@]}"
        else
            # System Python
            sudo $PYTHON_EXE -m pip install --quiet --force-reinstall --no-cache-dir "${INSTALL_PACKAGES[@]}"
        fi
        
        if [ $? -eq 0 ]; then
            echo "✅ All dependencies installed successfully"
        else
            echo "❌ Failed to install some dependencies"
            OVERALL_SUCCESS=false
        fi
    else
        echo "✅ All Python dependencies are installed"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$OVERALL_SUCCESS" = true ]; then
    echo "✅ Dependency check complete - all Python environments ready"
else
    echo "⚠️  Some dependencies failed to install"
    exit 1
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
