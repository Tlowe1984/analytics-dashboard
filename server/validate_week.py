#!/usr/bin/env python3
"""
Week Validation Helper
Validates that downloaded files are from current week or last week only.
Rejects files older than 14 days to ensure data freshness.
"""

import sys
from datetime import datetime, timedelta, timezone
import json


def get_week_number(dt):
    """Get ISO week number for a given datetime"""
    return dt.isocalendar()[1]


def validate_file_week(file_modified_time_str):
    """
    Validate that a file's modification time is within current or last week.
    
    Args:
        file_modified_time_str: ISO format timestamp string (e.g., "2026-02-26T17:00:00Z")
    
    Returns:
        dict with 'valid' (bool), 'message' (str), 'week' (int), 'age_days' (float)
    """
    try:
        # Parse the file modification time
        file_time = datetime.fromisoformat(file_modified_time_str.replace('Z', '+00:00'))
        
        # Get current time
        now = datetime.now(timezone.utc)
        
        # Calculate age in days
        age_days = (now - file_time).total_seconds() / 86400
        
        # Get week numbers
        current_week = get_week_number(now)
        file_week = get_week_number(file_time)
        last_week = get_week_number(now - timedelta(days=7))
        
        # Validate: file must be from current week or last week (max 14 days old)
        if age_days > 14:
            return {
                'valid': False,
                'message': f'File is {age_days:.1f} days old (W{file_week}), older than 14 days limit',
                'week': file_week,
                'age_days': age_days
            }
        
        if file_week not in [current_week, last_week]:
            return {
                'valid': False,
                'message': f'File is from W{file_week}, but current week is W{current_week}',
                'week': file_week,
                'age_days': age_days
            }
        
        return {
            'valid': True,
            'message': f'File is from W{file_week} ({age_days:.1f} days old) - valid',
            'week': file_week,
            'age_days': age_days
        }
        
    except Exception as e:
        return {
            'valid': False,
            'message': f'Error validating file week: {str(e)}',
            'week': None,
            'age_days': None
        }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({
            'valid': False,
            'message': 'Usage: validate_week.py <file_modified_time_iso>',
            'week': None,
            'age_days': None
        }))
        sys.exit(1)
    
    result = validate_file_week(sys.argv[1])
    print(json.dumps(result))
    sys.exit(0 if result['valid'] else 1)
