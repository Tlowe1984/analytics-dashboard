#!/usr/bin/python3.11
import sys
import json
from docx import Document
from docx.shared import RGBColor
from rich_text_parser import extract_rich_text

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
    if len(sys.argv) != 2:
        print("Usage: parse_systems_review.py <docx_path>")
        sys.exit(1)
    
    docx_path = sys.argv[1]
    items = parse_systems_review(docx_path)
    print(json.dumps(items, indent=2))
