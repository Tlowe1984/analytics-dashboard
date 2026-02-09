#!/usr/bin/env python3
"""
Parse Experiences & Interfaces Review document (weekly WXX file)
Extracts Wins, Exec Summary, and Decisions for three sections: I+E, AI, Hearing
"""

import sys
import json
import subprocess
import re
from docx import Document
from datetime import datetime, timedelta

def get_current_week():
    """Get current week number (ISO week)"""
    return datetime.now().isocalendar()[1]

def find_latest_review_file():
    """Find the most recent WXX Experiences & Interfaces Review file based on modification time"""
    try:
        # List files with metadata in the I+E reviews folder
        result = subprocess.run(
            [
                "rclone", "lsjson",
                "manus_google_drive:Wearables Everything/Reviews (Comment Only)/Software (I+E, AI, Hearing) Reviews/I+E Previous Reviews & Review Notes/",
                "--config", "/home/ubuntu/.gdrive-rclone.ini"
            ],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            print(f"rclone error: {result.stderr}", file=sys.stderr)
            return None
        
        # Parse JSON and find WXX Experiences & Interfaces Review files
        files_data = json.loads(result.stdout)
        review_files = []
        
        for item in files_data:
            name = item.get('Name', '')
            if re.match(r'W\d+\s+Experiences\s*&\s*Interfaces\s+Review\.docx', name, re.IGNORECASE):
                mod_time = item.get('ModTime', '')
                review_files.append({
                    'name': name,
                    'modified': mod_time
                })
        
        if not review_files:
            print("No review files found", file=sys.stderr)
            return None
        
        # Sort by modification time (most recent first)
        review_files.sort(key=lambda x: x['modified'], reverse=True)
        latest_file = review_files[0]['name']
        
        print(f"Found latest review file: {latest_file} (modified {review_files[0]['modified']})", file=sys.stderr)
        return latest_file
    
    except Exception as e:
        print(f"Error finding latest review file: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return None

def download_review_file(filename):
    """Download the review file from Google Drive"""
    try:
        result = subprocess.run(
            [
                "rclone", "copy",
                f"manus_google_drive:Wearables Everything/Reviews (Comment Only)/Software (I+E, AI, Hearing) Reviews/I+E Previous Reviews & Review Notes/{filename}",
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
        print(f"Error downloading review file: {e}", file=sys.stderr)
        return None

def parse_section(doc, start_idx, end_idx, section_name):
    """Parse a section of the document and extract Wins, Exec Summary, Decisions"""
    
    wins = []
    exec_summary = []
    decisions = []
    help_needed = []
    
    current_subsection = None
    current_item_parts = []  # Collect parts of current win/exec item
    
    for i in range(start_idx, end_idx):
        para = doc.paragraphs[i]
        text = para.text.strip()
        
        if not text:
            continue
        
        # Detect subsections (flexible patterns to handle spacing/capitalization variations)
        # Wins section: 🏆 + (Wins|Launches) + optional (Async|/)
        if re.search(r'🏆\s*(Wins?|Launches?)', text, re.IGNORECASE):
            # Save previous item if any
            if current_item_parts:
                if current_subsection == 'wins':
                    wins.append('\n'.join(current_item_parts))
                elif current_subsection == 'exec_summary':
                    exec_summary.append('\n'.join(current_item_parts))
                current_item_parts = []
            current_subsection = 'wins'
            continue
        # Exec Summary section: 🚀 + Exec Summary + optional (FYIs|Async)
        elif re.search(r'(🚀|📣)\s*(Exec\s+Summary|FYIs?)', text, re.IGNORECASE):
            # Save previous item if any
            if current_item_parts:
                if current_subsection == 'wins':
                    wins.append('\n'.join(current_item_parts))
                elif current_subsection == 'exec_summary':
                    exec_summary.append('\n'.join(current_item_parts))
                current_item_parts = []
            current_subsection = 'exec_summary'
            continue
        # Decisions section
        elif re.search(r'(Product\s+)?Decisions?\s*\[', text, re.IGNORECASE):
            # Save previous item if any
            if current_item_parts:
                if current_subsection == 'wins':
                    wins.append('\n'.join(current_item_parts))
                elif current_subsection == 'exec_summary':
                    exec_summary.append('\n'.join(current_item_parts))
                current_item_parts = []
            current_subsection = 'decisions'
            continue
        # Help Needed / Flags section
        elif re.search(r'🚩\s*(Help\s+Needed|Flag)', text, re.IGNORECASE):
            # Save previous item if any
            if current_item_parts:
                if current_subsection == 'wins':
                    wins.append('\n'.join(current_item_parts))
                elif current_subsection == 'exec_summary':
                    exec_summary.append('\n'.join(current_item_parts))
                current_item_parts = []
            current_subsection = 'help_needed'
            continue
        
        # Extract content based on current subsection
        if current_subsection == 'wins':
            # Check if this is a top-level item (category header)
            is_top_level = (
                text.startswith('[') or 
                (len(text) > 20 and ':' in text[:50]) or
                (len(text) < 50 and not para.style.name.startswith('List Bullet 2'))
            )
            
            if is_top_level and current_item_parts:
                # Save previous item and start new one
                wins.append('\n'.join(current_item_parts))
                current_item_parts = [text]
            else:
                # Add to current item (sub-bullet or continuation)
                current_item_parts.append(text)
        
        elif current_subsection == 'exec_summary':
            # Check if this is a top-level item
            is_top_level = (
                text.startswith('[') or 
                (len(text) > 20 and ':' in text[:50]) or
                (len(text) < 50 and not para.style.name.startswith('List Bullet 2'))
            )
            
            if is_top_level and current_item_parts:
                # Save previous item and start new one
                exec_summary.append('\n'.join(current_item_parts))
                current_item_parts = [text]
            else:
                # Add to current item
                current_item_parts.append(text)
        
        elif current_subsection == 'help_needed':
            if text.startswith('[') or text.startswith('-') or text.startswith('•') or text.startswith('○'):
                help_needed.append(text.lstrip('-•○ ').strip())
        
        elif current_subsection == 'decisions':
            # Decisions are often in tables, capture text that looks like decision items
            if text and len(text) > 10:
                decisions.append(text)
    
    # Save last item if any
    if current_item_parts:
        if current_subsection == 'wins':
            wins.append('\n'.join(current_item_parts))
        elif current_subsection == 'exec_summary':
            exec_summary.append('\n'.join(current_item_parts))
    
    return {
        'section': section_name,
        'wins': wins[:20],  # Limit to top 20 items
        'exec_summary': exec_summary[:30],  # Limit to top 30 items
        'help_needed': help_needed[:10],  # Limit to top 10 items
        'decisions': decisions[:20]  # Limit to top 20 items
    }

def main():
    print("Finding latest I+E review file...", file=sys.stderr)
    
    # Find latest review file
    latest_file = find_latest_review_file()
    if not latest_file:
        print("Failed to find review file", file=sys.stderr)
        print("[]")
        return 1
    
    # Download the file
    print(f"Downloading {latest_file}...", file=sys.stderr)
    local_path = download_review_file(latest_file)
    if not local_path:
        print("Failed to download review file", file=sys.stderr)
        print("[]")
        return 1
    
    # Parse the document
    print(f"Parsing {local_path}...", file=sys.stderr)
    try:
        doc = Document(local_path)
        
        # Find section boundaries
        sections = []
        for i, para in enumerate(doc.paragraphs):
            text = para.text.strip()
            if re.match(r'^(Experiences?\s*&\s*Interfaces?|AI|Hearing)\s*$', text, re.IGNORECASE):
                sections.append({
                    'name': text,
                    'index': i
                })
        
        if len(sections) < 3:
            print(f"Warning: Only found {len(sections)} sections, expected 3", file=sys.stderr)
        
        # Parse each section
        results = []
        for idx, section in enumerate(sections):
            start = section['index']
            end = sections[idx + 1]['index'] if idx + 1 < len(sections) else len(doc.paragraphs)
            
            section_data = parse_section(doc, start, end, section['name'])
            results.append(section_data)
            
            print(f"Parsed {section['name']}: {len(section_data['wins'])} wins, {len(section_data['exec_summary'])} exec items", file=sys.stderr)
        
        # Output as JSON
        print(json.dumps(results, indent=2))
        return 0
    
    except Exception as e:
        print(f"Error parsing document: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        print("[]")
        return 1

if __name__ == "__main__":
    sys.exit(main())
