#!/usr/bin/env python3
"""
Sync I+E Review data to database
Parses the weekly WXX Experiences & Interfaces Review document and populates software_items table
"""

import sys
import os
import json
import subprocess
import mysql.connector
from datetime import datetime

# Add server directory to path
sys.path.insert(0, os.path.dirname(__file__))

def get_db_connection():
    """Get database connection from environment"""
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise Exception("DATABASE_URL not set")
    
    # Parse MySQL connection string
    # Format: mysql://user:password@host:port/database?ssl={...}
    import re
    match = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', db_url)
    if not match:
        raise Exception(f"Invalid DATABASE_URL format: {db_url}")
    
    user, password, host, port, database = match.groups()
    
    return mysql.connector.connect(
        host=host,
        port=int(port),
        user=user,
        password=password,
        database=database,
        ssl_disabled=False
    )

def parse_ie_review():
    """Run the I+E review parser and get results"""
    try:
        result = subprocess.run(
            ['python3', '/home/ubuntu/analytics-dashboard/server/parse_ie_review.py'],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if result.returncode != 0:
            print(f"Parser error: {result.stderr}", file=sys.stderr)
            return None
        
        # Parse JSON output
        data = json.loads(result.stdout)
        return data
    
    except Exception as e:
        print(f"Error running parser: {e}", file=sys.stderr)
        return None

def sync_to_database(data):
    """Sync parsed data to database"""
    if not data:
        print("No data to sync", file=sys.stderr)
        return False
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Clear existing software items
        cursor.execute("DELETE FROM software_items")
        print(f"Cleared existing software items")
        
        # Map section names to database categories
        category_map = {
            'Experiences & Interfaces': 'software_ie',
            'AI': 'software_ai',
            'Hearing': 'software_hearing'
        }
        
        total_inserted = 0
        
        for section_data in data:
            section_name = section_data['section']
            db_category = category_map.get(section_name)
            
            if not db_category:
                print(f"Unknown section: {section_name}", file=sys.stderr)
                continue
            
            # Insert wins
            for idx, win in enumerate(section_data.get('wins', [])):
                cursor.execute(
                    """INSERT INTO software_items 
                    (software_category, section_type, content, is_new, indent_level, `order`)
                    VALUES (%s, %s, %s, %s, %s, %s)""",
                    (db_category, 'wins', win, 0, 0, idx)
                )
                total_inserted += 1
            
            # Insert exec summary
            for idx, item in enumerate(section_data.get('exec_summary', [])):
                cursor.execute(
                    """INSERT INTO software_items 
                    (software_category, section_type, content, is_new, indent_level, `order`)
                    VALUES (%s, %s, %s, %s, %s, %s)""",
                    (db_category, 'exec_summary', item, 0, 0, idx)
                )
                total_inserted += 1
            
            # Insert structured decisions
            for idx, decision in enumerate(section_data.get('structured_decisions', [])):
                cursor.execute(
                    """INSERT INTO software_items 
                    (software_category, section_type, content, topic, dri, forum, status, decision_doc, decision_makers, decision_outcome, post, is_new, indent_level, `order`)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (db_category, 'decisions', '', decision.get('topic', ''), decision.get('dri', ''), 
                     decision.get('forum', ''), decision.get('status', ''), decision.get('decision_doc', ''),
                     decision.get('decision_makers', ''), decision.get('decision_outcome', ''), 
                     decision.get('post', ''), 0, 0, idx)
                )
                total_inserted += 1
            
            print(f"Synced {section_name}: {len(section_data.get('wins', []))} wins, {len(section_data.get('exec_summary', []))} exec items, {len(section_data.get('structured_decisions', []))} decisions")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"✓ Successfully synced {total_inserted} items to database")
        return True
    
    except Exception as e:
        print(f"Database error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=" * 60)
    print("Syncing I+E Review Data")
    print("=" * 60)
    
    # Parse the review document
    print("\n1. Parsing I+E review document...")
    data = parse_ie_review()
    
    if not data:
        print("✗ Failed to parse I+E review document")
        return 1
    
    # Sync to database
    print("\n2. Syncing to database...")
    success = sync_to_database(data)
    
    if not success:
        print("✗ Failed to sync to database")
        return 1
    
    print("\n" + "=" * 60)
    print("✓ I+E Review sync completed successfully")
    print("=" * 60)
    return 0

if __name__ == "__main__":
    sys.exit(main())
