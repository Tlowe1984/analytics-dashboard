#!/usr/bin/env python3
"""
Extract [wearables-tag] items from Systems Review document
Matches the SOFTWARE hotspot extraction pattern:
- Finds bullets with [wearables-tag]
- Preserves rich text formatting
- Bolds titles (text before " - ")
- Removes [wearables-tag] marker
- Removes **** artifacts
"""

import sys
import re
from docx import Document
from rich_text_parser_v2 import extract_rich_text_with_links

def classify_as_highlight_or_risk(text):
    """
    Classify content as highlight (positive) or risk (negative/problem).
    Returns 'wins' for highlights, 'exec_summary' for risks/opens.
    """
    # Keywords indicating positive/highlight content
    highlight_keywords = [
        'dogfood', 'ready', 'enabled', 'completed', 'success', 'shipped', 'launched',
        'improved', 'resolved', 'fixed', 'delivered', 'achieved', 'milestone',
        'operating', 'stable', 'working', 'finalized', 'approved'
    ]
    
    # Keywords indicating risk/problem content
    risk_keywords = [
        'issue', 'risk', 'problem', 'concern', 'blocker', 'delayed', 'slowing',
        'affecting', 'failure', 'critical', 'urgent', 'trending out', 'reassessment',
        'unless addressed', 'impact', 'sev', 'regression'
    ]
    
    text_lower = text.lower()
    
    # Count keyword matches
    highlight_count = sum(1 for kw in highlight_keywords if kw in text_lower)
    risk_count = sum(1 for kw in risk_keywords if kw in text_lower)
    
    # Classify based on keyword prevalence
    if risk_count > highlight_count:
        return 'exec_summary'  # Risks/Opens
    else:
        return 'wins'  # Highlights

def extract_wearables_tagged_systems(doc):
    """
    Extract all bullets containing [wearables-tag] from the Systems document.
    Returns a list of dicts with section_type, content, and metadata.
    """
    wearables_items = []
    
    for para in doc.paragraphs:
        text = para.text.strip()
        
        # Skip empty paragraphs
        if not text:
            continue
        
        # Check if paragraph contains [wearables-tag]
        if '[wearables-tag]' not in text.lower():
            continue
        
        # Extract rich text with links
        rich_content = extract_rich_text_with_links(para)
        
        # Remove [wearables-tag] marker (case insensitive)
        rich_content = re.sub(r'\[wearables-tag\]', '', rich_content, flags=re.IGNORECASE).strip()
        
        # Remove **** artifacts (from consecutive bold formatting)
        rich_content = re.sub(r'\*{4,}', '', rich_content)
        
        # Bold the title if there's a " - " separator
        # Pattern: "Title - Description" becomes "**Title** - Description"
        if ' - ' in rich_content:
            parts = rich_content.split(' - ', 1)
            if len(parts) == 2:
                title = parts[0].strip()
                description = parts[1].strip()
                # Remove any existing ** from title first
                title = re.sub(r'\*\*', '', title)
                rich_content = f"**{title}** - {description}"
        
        # Classify as highlight or risk
        section_type = classify_as_highlight_or_risk(text)
        
        wearables_items.append({
            'section_type': section_type,
            'content': rich_content
        })
        print(f"Found wearables-tagged system item ({section_type}): {text[:80]}...", file=sys.stderr)
    
    print(f"Extracted {len(wearables_items)} wearables-tagged system items", file=sys.stderr)
    return wearables_items

if __name__ == "__main__":
    # This script is meant to be imported, but can be tested standalone
    if len(sys.argv) > 1:
        doc_path = sys.argv[1]
        doc = Document(doc_path)
        items = extract_wearables_tagged_systems(doc)
        for item in items:
            print(item)
