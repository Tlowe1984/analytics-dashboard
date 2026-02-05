#!/usr/bin/env python3.11
import json
import sys
from docx import Document
from rich_text_parser_v2 import extract_rich_text

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
        
        # Stop if we hit another major section (but not "Highlights/ Decisions/" subsection)
        if text == 'Hotspots' or (text == 'Decisions' and not current_product):
            break
        
        if not in_exec_summary:
            continue
        
        # Detect product categories
        if text in ['AI Glasses', 'Wrist', 'ARG/SSG', 'ARG / SSG', 'In-Market', 'In Market']:
            current_product = text.replace(' / ', '_').replace('/', '_').replace(' ', '_').replace('-', '_').lower()
            if current_product == 'arg_ssg':
                current_product = 'arg_ssg'
            elif current_product == 'in_market':
                current_product = 'in_market'
            continue
        
        # Detect section types (match exact or prefix)
        if text in ['Highlights', 'Risks/Opens', 'Upcoming'] or text.startswith('Highlights') or text.startswith('Risks') or text.startswith('Upcoming'):
            # Map to canonical section names
            if text.startswith('Highlights') or text == 'Highlights':
                current_section = 'highlights'
            elif text.startswith('Risks') or text == 'Risks/Opens':
                current_section = 'risks'
            elif text.startswith('Upcoming') or text == 'Upcoming':
                current_section = 'upcoming'
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
        
        # Get numbering level for indentation
        # Level 0: Product (AI Glasses, Wrist, ARG/SSG)
        # Level 1: Section (Highlights, Risks/Opens, Upcoming)
        # Level 2: Main bullets (should be flush left, indent_level=0)
        # Level 3+: Sub-bullets (should be indented, indent_level=1+)
        indent_level = 0
        numbering_part = para._element.pPr.numPr if para._element.pPr is not None and hasattr(para._element.pPr, 'numPr') else None
        if numbering_part is not None and numbering_part.ilvl is not None:
            doc_level = numbering_part.ilvl.val
            # Map document levels to UI indent levels
            # doc_level 0,1,2 -> indent_level 0 (flush left)
            # doc_level 3+ -> indent_level 1+ (indented)
            if doc_level >= 3:
                indent_level = doc_level - 2
        
        # Extract rich text with bold and links
        rich_content = extract_rich_text(para)
        
        # Add the item
        items.append({
            'product': current_product,
            'section': current_section,
            'content': rich_content,
            'is_new': 1 if is_new else 0,
            'indent_level': indent_level
        })
    
    print(json.dumps(items))
except Exception as e:
    print(json.dumps([]), file=sys.stderr)
    sys.exit(1)
