#!/usr/bin/env python3
"""
Parse Wearables Systems Review document (weekly WK## file)
Extracts Wins, Exec Summary, and Help Needed sections
"""

import sys
import json
import subprocess
import re
from docx import Document
from datetime import datetime
from rich_text_parser_v2 import extract_rich_text
from extract_systems_wearables import extract_wearables_tagged_systems

def find_latest_systems_review_file():
    """Find the most recent WK## Wearables Systems Review file based on modification time"""
    try:
        # List files with metadata in the Systems Software Reviews/Archive folder
        result = subprocess.run(
            [
                "rclone", "lsjson",
                "manus_google_drive:Wearables Everything/Reviews (Comment Only)/Systems Software Reviews/Archive/",
                "--config", "/home/ubuntu/.gdrive-rclone.ini"
            ],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            print(f"rclone error: {result.stderr}", file=sys.stderr)
            return None
        
        # Parse JSON and find WK## Wearables Systems Review files
        files_data = json.loads(result.stdout)
        review_files = []
        
        for item in files_data:
            name = item.get('Name', '')
            # Match pattern: "Wearables Systems Review-WK##-2026.docx" or "Wearables Systems Review WK## 2026.docx"
            if re.match(r'Wearables\s+Systems\s+Review[-\s]+WK?\d+[-\s]+2026\.docx', name, re.IGNORECASE):
                mod_time = item.get('ModTime', '')
                review_files.append({
                    'name': name,
                    'modified': mod_time
                })
        
        if not review_files:
            print("No Systems review files found", file=sys.stderr)
            return None
        
        # Sort by modification time (most recent first)
        review_files.sort(key=lambda x: x['modified'], reverse=True)
        latest_file = review_files[0]['name']
        
        print(f"Found latest Systems review file: {latest_file} (modified {review_files[0]['modified']})", file=sys.stderr)
        return latest_file
    
    except Exception as e:
        print(f"Error finding latest Systems review file: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return None

def download_systems_review_file(filename):
    """Download the Systems review file from Google Drive"""
    try:
        # Clear cache first
        subprocess.run(
            ["rm", "-f", f"/tmp/{filename}"],
            capture_output=True,
            timeout=5
        )
        
        result = subprocess.run(
            [
                "rclone", "copy",
                f"manus_google_drive:Wearables Everything/Reviews (Comment Only)/Systems Software Reviews/Archive/{filename}",
                "/tmp/",
                "--config", "/home/ubuntu/.gdrive-rclone.ini"
            ],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            print(f"rclone error: {result.stderr}", file=sys.stderr)
            return None
        
        return f"/tmp/{filename}"
    
    except Exception as e:
        print(f"Error downloading Systems review file: {e}", file=sys.stderr)
        return None

def parse_systems_review(docx_path):
    """
    Parse Wearable Systems Review document to extract Wins, Exec Summary, and Help Needed sections.
    Returns a list of items with section type, content, and is_new flag (for blue text).
    """
    doc = Document(docx_path)
    items = []
    current_section = None
    order = 0
    
    # Section markers
    wins_markers = ["🏆 Wins", "Wins [Async]"]
    exec_summary_markers = ["🚀 Exec Summary", "Exec Summary [Async]"]
    help_needed_markers = ["🆘 Help Needed", "Help Needed / Flag for Leadership"]
    
    for para in doc.paragraphs:
        text = para.text.strip()
        
        if not text:
            continue
            
        # Check for section headers
        if any(marker in text for marker in wins_markers):
            current_section = "wins"
            continue
        elif any(marker in text for marker in exec_summary_markers):
            current_section = "exec_summary"
            continue
        elif any(marker in text for marker in help_needed_markers):
            current_section = "help_needed"
            continue
        
        # Skip if we haven't entered a section yet
        if current_section is None:
            continue
        
        # Check if this is a bullet point or content line (not a sub-header)
        # Skip lines that look like sub-headers (short, all caps, or contain only emojis)
        if len(text) < 10 or text.isupper() or all(c in "⚠️🔴✅🎯🎉🆘🏆🚀 " for c in text):
            continue
        
        # Detect blue text (new information)
        is_new = 0
        for run in para.runs:
            if run.font.color and run.font.color.type == 1:  # RGB color
                rgb = run.font.color.rgb
                # Check if it's blue-ish (R < 100, G < 150, B > 150)
                # RGBColor is a tuple-like (r, g, b)
                if rgb[0] < 100 and rgb[1] < 150 and rgb[2] > 150:
                    is_new = 1
                    break
        
        # Get numbering level for indentation
        # Level 0: Section headers
        # Level 1: Main bullets (should be flush left, indent_level=0)
        # Level 2+: Sub-bullets (should be indented, indent_level=1+)
        indent_level = 0
        numbering_part = para._element.pPr.numPr if para._element.pPr is not None and hasattr(para._element.pPr, 'numPr') else None
        if numbering_part is not None and numbering_part.ilvl is not None:
            doc_level = numbering_part.ilvl.val
            # Map document levels to UI indent levels
            # doc_level 0,1 -> indent_level 0 (flush left)
            # doc_level 2+ -> indent_level 1+ (indented)
            if doc_level >= 2:
                indent_level = doc_level - 1
        
        # Extract rich text with bold and links
        rich_content = extract_rich_text(para)
        
        items.append({
            "section_type": current_section,
            "content": rich_content,
            "is_new": is_new,
            "indent_level": indent_level,
            "order": order
        })
        order += 1
    
    return items

if __name__ == "__main__":
    # Find latest weekly archive file
    print("Finding latest Systems review file...", file=sys.stderr)
    latest_file = find_latest_systems_review_file()
    
    if not latest_file:
        print("Error: Could not find latest Systems review file", file=sys.stderr)
        sys.exit(1)
    
    # Download the file
    print(f"Downloading {latest_file}...", file=sys.stderr)
    docx_path = download_systems_review_file(latest_file)
    
    if not docx_path:
        print("Error: Could not download Systems review file", file=sys.stderr)
        sys.exit(1)
    
    # Parse the document
    print(f"Parsing {latest_file}...", file=sys.stderr)
    items = parse_systems_review(docx_path)
    
    # Extract wearables-tagged items
    print("Extracting wearables-tagged items...", file=sys.stderr)
    doc = Document(docx_path)
    wearables_items = extract_wearables_tagged_systems(doc)
    
    # Add wearables-tagged items to the output (already classified as wins or exec_summary)
    for idx, item in enumerate(wearables_items):
        items.append({
            "section_type": item['section_type'],
            "content": item['content'],
            "is_new": 0,
            "is_wearables_tag": 1,  # Mark as wearables-tagged item
            "indent_level": 0,
            "order": len(items) + idx
        })
    
    # Output JSON to stdout
    print(json.dumps(items, indent=2))
