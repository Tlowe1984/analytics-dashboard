#!/usr/bin/python3.11
"""
Parse Software (I+E, AI, Hearing) Canonical Program Review document
Extracts Wins, Product Decisions, and Hotspots sections
"""

import sys
import json
from docx import Document
from docx.shared import RGBColor
from rich_text_parser_v2 import extract_rich_text

def is_blue_text(run):
    """Check if text run has blue color (indicating new information)"""
    if run.font.color and run.font.color.rgb:
        r, g, b = run.font.color.rgb
        # Check if color is predominantly blue
        return b > 150 and b > r and b > g
    return False

def parse_software_review(docx_path):
    """
    Parse the Software review document and extract items by section
    Returns list of dicts with: section_type, content, is_new, order
    """
    doc = Document(docx_path)
    items = []
    current_section = None
    order = 0
    
    # Section markers
    wins_markers = ["🏆 Wins", "Wins"]
    exec_summary_markers = ["🚀 Exec Summary", "Exec Summary"]
    decisions_markers = ["Product Decisions"]
    
    for para in doc.paragraphs:
        text = para.text.strip()
        
        if not text:
            continue
            
        # Check for section headers
        if any(marker in text for marker in wins_markers):
            current_section = "wins"
            order = 0
            continue
        elif any(marker in text for marker in exec_summary_markers):
            current_section = "exec_summary"
            order = 0
            continue
        elif any(marker in text for marker in decisions_markers):
            current_section = "decisions"
            order = 0
            continue
        
        # Skip if we haven't found a section yet
        if current_section is None:
            continue
            
        # Skip section headers and empty lines
        if text.startswith("📣") or text.startswith("FYIs"):
            continue
        if text.startswith("🗓️ Upcoming Releases"):
            break  # Stop at upcoming releases section
        if text.startswith("Portfolio View"):
            break  # Stop at portfolio view
        if text.startswith("🚩 Leadership Help Needed"):
            break  # Stop at hotspots section
            
        # Check if this is a content line (starts with bracket or bullet)
        if text.startswith("[") or text.startswith("•") or text.startswith("-"):
            # Check if any run in this paragraph has blue text
            has_blue = any(is_blue_text(run) for run in para.runs)
            
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
                "is_new": 1 if has_blue else 0,
                "indent_level": indent_level,
                "order": order
            })
            order += 1
    
    return items

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: parse_software_review.py <docx_file>", file=sys.stderr)
        sys.exit(1)
    
    docx_path = sys.argv[1]
    items = parse_software_review(docx_path)
    print(json.dumps(items, indent=2))
