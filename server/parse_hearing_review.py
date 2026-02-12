#!/usr/bin/env python3
"""
Parse WXX Health Canonical Program Review document
Extracts Wins, Exec Summary, and Decisions sections with rich text formatting
"""

import sys
import json
from docx import Document
from rich_text_parser_v2 import extract_rich_text

def parse_hearing_review(docx_path):
    """
    Parse Health Canonical Program Review document to extract Wins, Exec Summary, and Decisions sections.
    Returns structured data with rich text formatting preserved.
    """
    doc = Document(docx_path)
    
    items = []
    current_section = None
    order = 0
    
    # Section headers we're looking for
    section_map = {
        'wins': 'wins',
        'exec summary': 'exec_summary',
        'decisions': 'decisions'
    }
    
    for para in doc.paragraphs:
        text = para.text.strip()
        
        if not text:
            continue
        
        # Check if this is a section header
        text_lower = text.lower()
        if text_lower in section_map:
            current_section = section_map[text_lower]
            continue
        
        # Skip if we haven't found a section yet
        if current_section is None:
            continue
        
        # Extract rich text content
        rich_text = extract_rich_text(para)
        
        if not rich_text or rich_text.strip() == '':
            continue
        
        # Detect if this is a "new" item (blue text)
        is_new = False
        for run in para.runs:
            if run.font.color and run.font.color.rgb:
                r, g, b = run.font.color.rgb
                # Blue text detection (similar to other parsers)
                if b > 150 and r < 100 and g < 100:
                    is_new = True
                    break
        
        # Detect indent level
        indent_level = 0
        if para.paragraph_format.left_indent:
            # Convert indent to level (assuming 0.5 inch per level)
            indent_inches = para.paragraph_format.left_indent.inches
            indent_level = int(indent_inches / 0.5)
        
        items.append({
            'section_type': current_section,
            'content': rich_text,
            'is_new': is_new,
            'indent_level': indent_level,
            'order': order
        })
        
        order += 1
    
    return {
        'items': items,
        'total_count': len(items)
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: parse_hearing_review.py <docx_path>'}))
        sys.exit(1)
    
    docx_path = sys.argv[1]
    
    try:
        result = parse_hearing_review(docx_path)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
