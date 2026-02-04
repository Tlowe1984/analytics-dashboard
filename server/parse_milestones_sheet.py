#!/usr/bin/env python3
"""
Parse Wearable Program Milestones SOT spreadsheet
Extracts PDP gates, SW milestones, HW dates, and release milestones
"""

import sys
import json
import subprocess
from datetime import datetime
import re

# Google Sheets ID
SHEET_ID = "13a184kjaZxLOo0CjNsWpmQ8Z3lhRJRtd1MUtCxyQZs8"
SHEET_GID = "0"  # First sheet

def download_sheet_as_csv():
    """Download Google Sheet as CSV using wget"""
    csv_url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={SHEET_GID}"
    output_file = "/tmp/milestones.csv"
    
    try:
        subprocess.run(
            ["wget", "-q", "-O", output_file, csv_url],
            check=True,
            timeout=30
        )
        return output_file
    except Exception as e:
        print(f"Error downloading sheet: {e}", file=sys.stderr)
        return None

def parse_week_to_date(week_str):
    """Convert week string like 'W5 2026' to a date"""
    if not week_str or not isinstance(week_str, str):
        return None
    
    # Match patterns like "W5 2026", "W5", "2026-02-03"
    week_match = re.match(r'W(\d+)\s*(\d{4})?', week_str.strip())
    if week_match:
        week_num = int(week_match.group(1))
        year = int(week_match.group(2)) if week_match.group(2) else 2026
        
        # Convert week number to date (approximate - week 1 starts around Jan 1)
        # This is a rough approximation
        days_offset = (week_num - 1) * 7
        try:
            base_date = datetime(year, 1, 1)
            milestone_date = base_date.replace(day=1 + days_offset)
            return milestone_date.strftime("%Y-%m-%d")
        except:
            return None
    
    # Try parsing as ISO date
    try:
        date_obj = datetime.fromisoformat(week_str.strip())
        return date_obj.strftime("%Y-%m-%d")
    except:
        pass
    
    return None

def parse_milestones_csv(csv_file):
    """Parse the CSV file and extract milestones"""
    import csv
    
    milestones = []
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                # Skip empty rows
                if not any(row.values()):
                    continue
                
                # Extract fields (adjust column names based on actual spreadsheet)
                product = row.get('Product', '').strip()
                milestone_name = row.get('Milestone', '').strip()
                date_str = row.get('Date', '') or row.get('Week', '') or row.get('Target Date', '')
                milestone_type = row.get('Type', '').strip().lower()
                
                if not product or not milestone_name:
                    continue
                
                # Parse date
                milestone_date = parse_week_to_date(date_str)
                if not milestone_date:
                    continue
                
                # Determine milestone type
                if 'pdp' in milestone_name.lower() or 'commit' in milestone_name.lower() or 'gate' in milestone_name.lower():
                    type_enum = 'pdp_gates'
                elif 'launch' in milestone_name.lower() or 'release' in milestone_name.lower() or 'osd' in milestone_name.lower():
                    type_enum = 'release_milestones'
                elif 'sw' in milestone_type or 'software' in milestone_type or 'fatp' in milestone_name.lower() or 'beta' in milestone_name.lower():
                    type_enum = 'sw_milestones'
                elif 'hw' in milestone_type or 'hardware' in milestone_type or 'evt' in milestone_name.lower() or 'dvt' in milestone_name.lower() or 'pvt' in milestone_name.lower():
                    type_enum = 'hw_dates'
                else:
                    # Default to pdp_gates for product commits
                    type_enum = 'pdp_gates'
                
                milestones.append({
                    'product': product,
                    'milestone_name': milestone_name,
                    'milestone_date': milestone_date,
                    'milestone_type': type_enum,
                    'original_type': milestone_type if milestone_type else None
                })
    
    except Exception as e:
        print(f"Error parsing CSV: {e}", file=sys.stderr)
        return []
    
    return milestones

def main():
    # Download spreadsheet
    csv_file = download_sheet_as_csv()
    if not csv_file:
        print("[]")
        return 1
    
    # Parse milestones
    milestones = parse_milestones_csv(csv_file)
    
    # Output as JSON
    print(json.dumps(milestones, indent=2))
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
