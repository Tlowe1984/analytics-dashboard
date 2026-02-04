#!/usr/bin/env python3
"""
Sync milestones from Wearable Program Milestones SOT spreadsheet
Uses rclone to access Google Sheets and parse milestone data
"""

import sys
import json
import subprocess
import tempfile
import csv
from datetime import datetime, timedelta
import re

# Spreadsheet ID from URL: https://docs.google.com/spreadsheets/d/13a184kjaZxLOo0CjNsWpmQ8Z3lhRJRtd1MUtCxyQZs8/
SHEET_ID = "13a184kjaZxLOo0CjNsWpmQ8Z3lhRJRtd1MUtCxyQZs8"
RCLONE_CONFIG = "/home/ubuntu/.gdrive-rclone.ini"

def download_sheet_via_rclone():
    """Download Google Sheet as CSV using rclone with authentication"""
    try:
        # Use rclone cat to read the file content directly
        # Google Sheets files need to be exported, we'll use the export URL approach
        result = subprocess.run(
            [
                "rclone", "copyurl",
                f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid=0",
                "/tmp/milestones_from_gdrive.csv",
                "--config", RCLONE_CONFIG,
                "--drive-acknowledge-abuse"
            ],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            print(f"rclone error: {result.stderr}", file=sys.stderr)
            return None
        
        return "/tmp/milestones_from_gdrive.csv"
    except Exception as e:
        print(f"Error downloading sheet: {e}", file=sys.stderr)
        return None

def parse_week_to_date(week_str):
    """Convert week string like 'W5 2026' or date string to ISO date"""
    if not week_str or not isinstance(week_str, str):
        return None
    
    week_str = week_str.strip()
    
    # Match patterns like "W5 2026", "W5 '26", "W05 2026"
    week_match = re.match(r"W'?(\d+)\s*['\"]?(\d{2,4})?", week_str, re.IGNORECASE)
    if week_match:
        week_num = int(week_match.group(1))
        year_str = week_match.group(2)
        
        if year_str:
            year = int(year_str)
            # Handle 2-digit years
            if year < 100:
                year = 2000 + year
        else:
            year = 2026  # Default year
        
        # Convert ISO week to date (Monday of that week)
        # Week 1 is the week with Jan 4 in it
        jan4 = datetime(year, 1, 4)
        week1_monday = jan4 - timedelta(days=jan4.weekday())
        target_date = week1_monday + timedelta(weeks=week_num - 1)
        
        return target_date.strftime("%Y-%m-%d")
    
    # Try parsing as date in various formats
    for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%d-%b-%Y", "%d-%b-%y"]:
        try:
            date_obj = datetime.strptime(week_str, fmt)
            return date_obj.strftime("%Y-%m-%d")
        except:
            continue
    
    return None

def categorize_milestone(product, milestone_name, type_hint=""):
    """Determine milestone type based on name and context"""
    name_lower = milestone_name.lower()
    type_lower = type_hint.lower() if type_hint else ""
    product_lower = product.lower()
    
    # Release/Launch dates
    if any(keyword in name_lower for keyword in ["launch", "release", "osd", "in market", "ship"]):
        return "release_milestones"
    
    # PDP Gates (Product Development Process)
    if any(keyword in name_lower for keyword in ["commit", "gate", "checkpoint", "concept", "discover", "define", "develop", "deliver"]):
        return "pdp_gates"
    
    # Software milestones
    if any(keyword in name_lower for keyword in ["fatp", "beta", "alpha", "zbb", "gmc", "fmc", "lbu-os", "dogfood"]):
        return "sw_milestones"
    
    # Hardware dates
    if any(keyword in name_lower for keyword in ["evt", "dvt", "pvt", "p1", "p2", "p3", "smt", "build"]):
        return "hw_dates"
    
    # Check type hint
    if "sw" in type_lower or "software" in type_lower:
        return "sw_milestones"
    if "hw" in type_lower or "hardware" in type_lower:
        return "hw_dates"
    if "pdp" in type_lower or "gate" in type_lower:
        return "pdp_gates"
    
    # Default to PDP gates for ambiguous cases
    return "pdp_gates"

def parse_milestones_csv(csv_file):
    """Parse CSV and extract milestones"""
    milestones = []
    
    try:
        with open(csv_file, 'r', encoding='utf-8-sig') as f:  # utf-8-sig handles BOM
            # Read first few lines to detect header
            content = f.read()
            f.seek(0)
            
            # Try to find header row
            lines = content.split('\n')
            header_row_idx = 0
            
            # Look for a row with "Product" or "Milestone" or "Date"
            for idx, line in enumerate(lines[:10]):
                if any(keyword in line.lower() for keyword in ["product", "milestone", "date", "week"]):
                    header_row_idx = idx
                    break
            
            # Skip to header row
            for _ in range(header_row_idx):
                f.readline()
            
            reader = csv.DictReader(f)
            
            for row in reader:
                # Skip empty rows
                if not any(row.values()):
                    continue
                
                # Try different possible column names
                product = (row.get('Product') or row.get('product') or row.get('PRODUCT') or '').strip()
                milestone_name = (row.get('Milestone') or row.get('milestone') or row.get('Milestone Name') or row.get('Name') or '').strip()
                date_str = (row.get('Date') or row.get('date') or row.get('Week') or row.get('week') or row.get('Target Date') or '').strip()
                type_hint = (row.get('Type') or row.get('type') or row.get('Category') or '').strip()
                
                # Skip if missing essential fields
                if not product or not milestone_name or not date_str:
                    continue
                
                # Parse date
                milestone_date = parse_week_to_date(date_str)
                if not milestone_date:
                    continue
                
                # Categorize milestone
                milestone_type = categorize_milestone(product, milestone_name, type_hint)
                
                milestones.append({
                    'product': product,
                    'milestone_name': milestone_name,
                    'milestone_date': milestone_date,
                    'milestone_type': milestone_type,
                    'original_type': type_hint if type_hint else None
                })
    
    except Exception as e:
        print(f"Error parsing CSV: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return []
    
    return milestones

def main():
    print("Downloading Wearable Program Milestones SOT spreadsheet...", file=sys.stderr)
    
    # Download spreadsheet
    csv_file = download_sheet_via_rclone()
    if not csv_file:
        print("Failed to download spreadsheet", file=sys.stderr)
        print("[]")
        return 1
    
    # Check if file has content
    try:
        with open(csv_file, 'r') as f:
            content = f.read()
            if not content or len(content) < 10:
                print(f"Downloaded file is empty or too small ({len(content)} bytes)", file=sys.stderr)
                print("[]")
                return 1
    except Exception as e:
        print(f"Error reading downloaded file: {e}", file=sys.stderr)
        print("[]")
        return 1
    
    print(f"Parsing milestones from CSV...", file=sys.stderr)
    
    # Parse milestones
    milestones = parse_milestones_csv(csv_file)
    
    print(f"Found {len(milestones)} milestones", file=sys.stderr)
    
    # Output as JSON
    print(json.dumps(milestones, indent=2))
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
