#!/usr/bin/env python3
import json
import sys
from docx import Document

if len(sys.argv) < 2:
    print(json.dumps([]))
    sys.exit(0)

doc_path = sys.argv[1]

try:
    doc = Document(doc_path)
    
    items = []
    current_product = None
    current_section = None
    in_exec_summary = False
    
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        
        # Check if we're in Exec Summary section
        if 'Exec Summary' in text:
            in_exec_summary = True
            continue
        
        # Stop if we hit another major section
        if 'Hotspots' in text or 'Decisions' in text:
            break
        
        if not in_exec_summary:
            continue
        
        # Detect product categories
        if text in ['AI Glasses', 'Wrist', 'ARG/SSG', 'ARG / SSG']:
            current_product = text.replace(' / ', '_').replace('/', '_').replace(' ', '_').lower()
            if current_product == 'arg_ssg':
                current_product = 'arg_ssg'
            continue
        
        # Detect section types
        if text in ['Highlights', 'Risks/Opens', 'Upcoming']:
            current_section = text.lower().replace('/', '_').replace(' ', '_')
            if current_section == 'risks_opens':
                current_section = 'risks'
            continue
        
        # Skip if we don't have both product and section
        if not current_product or not current_section:
            continue
        
        # Check if text is blue (new information)
        is_new = False
        for run in para.runs:
            if run.font.color and run.font.color.rgb:
                r, g, b = run.font.color.rgb
                # Check if color is blue-ish (more blue than red/green)
                if b > 150 and b > r and b > g:
                    is_new = True
                    break
        
        # Detect indentation level - only indent if significantly indented (sub-bullets)
        indent_level = 0
        if para.paragraph_format.left_indent and para.paragraph_format.left_indent > 720000:
            # Only indent if left_indent > 720000 twips (≈ 0.5 inch)
            # Convert to indent level (each 360000 twips ≈ 1 level)
            indent_level = max(1, int((para.paragraph_format.left_indent - 720000) / 360000) + 1)
        
        # Add the item
        items.append({
            'product': current_product,
            'section': current_section,
            'content': text,
            'is_new': 1 if is_new else 0,
            'indent_level': indent_level
        })
    
    print(json.dumps(items))
except Exception as e:
    print(json.dumps([]), file=sys.stderr)
    sys.exit(1)
