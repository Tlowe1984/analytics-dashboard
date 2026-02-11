"""
Extract Hotspots table from I+E Review document
Finds rows with [wearables-tag], summarizes with Gemini, and formats output
"""

import re
import os
import sys
import requests
from rich_text_parser_v2 import extract_rich_text_with_links

def summarize_with_gemini(text, max_words=20):
    """Truncate text to max_words"""
    # Simple truncation - just take first max_words
    words = text.split()
    if len(words) <= max_words:
        return text
    return ' '.join(words[:max_words]) + '...'

def extract_hotspots_with_wearables_tag(doc):
    """
    Extract hotspots from the Hotspots table that contain [wearables-tag]
    Returns list of formatted hotspot items
    """
    hotspots = []
    
    try:
        # Find the Hotspots table
        for table in doc.tables:
            # Check if this is the Hotspots table by looking at header row
            if len(table.rows) < 2:
                continue
            
            header_row = table.rows[0]
            header_text = ' '.join([cell.text.strip() for cell in header_row.cells])
            
            # Check if this is the Hotspots table
            if not re.search(r'Hotspot.*Why.*Matters', header_text, re.IGNORECASE):
                continue
            
            print(f"Found Hotspots table with {len(table.rows)} rows", file=sys.stderr)
            
            # Identify column indices
            col_hotspot = None
            col_deep_dive = None
            col_update = None
            
            for idx, cell in enumerate(header_row.cells):
                text = cell.text.strip().lower()
                if 'hotspot' in text or 'why it matters' in text:
                    col_hotspot = idx
                elif 'deep dive' in text or 'one pager' in text:
                    col_deep_dive = idx
                elif 'update' in text:
                    col_update = idx
            
            if col_hotspot is None or col_update is None:
                print("Warning: Could not identify required columns in Hotspots table", file=sys.stderr)
                continue
            
            # Process each row (skip header)
            for row_idx in range(1, len(table.rows)):
                row = table.rows[row_idx]
                
                if len(row.cells) <= max(col_hotspot, col_update):
                    continue
                
                # Extract cell content
                hotspot_cell = row.cells[col_hotspot]
                update_cell = row.cells[col_update]
                deep_dive_cell = row.cells[col_deep_dive] if col_deep_dive is not None else None
                
                hotspot_text = hotspot_cell.text.strip()
                update_text = update_cell.text.strip()
                
                # Check for [wearables-tag] in either column
                has_tag = '[wearables-tag]' in hotspot_text.lower() or '[wearables-tag]' in update_text.lower()
                
                if not has_tag:
                    continue
                
                print(f"Found wearables-tagged hotspot: {hotspot_text[:50]}...", file=sys.stderr)
                
                # Extract title (strip tag)
                title = re.sub(r'\[wearables-tag\]', '', hotspot_text, flags=re.IGNORECASE).strip()
                
                # Extract rich text from title for formatting
                title_rich = extract_rich_text_with_links(hotspot_cell.paragraphs[0]) if hotspot_cell.paragraphs else title
                title_rich = re.sub(r'\[wearables-tag\]', '', title_rich, flags=re.IGNORECASE).strip()
                
                # Summarize update with Gemini
                update_clean = re.sub(r'\[wearables-tag\]', '', update_text, flags=re.IGNORECASE).strip()
                summary = summarize_with_gemini(update_clean, max_words=20)
                
                # Extract deep dive link
                link_url = None
                if deep_dive_cell:
                    for para in deep_dive_cell.paragraphs:
                        # Check for hyperlinks in paragraph
                        for rel in para.part.rels.values():
                            if "hyperlink" in rel.reltype:
                                link_url = rel.target_ref
                                break
                        if link_url:
                            break
                        # Fallback: check if text looks like a URL
                        text = para.text.strip()
                        if text.startswith('http'):
                            link_url = text
                            break
                
                # Format output: **Title** - Summary [link]
                formatted_item = f"**{title}** - {summary}"
                if link_url:
                    formatted_item += f" [link]({link_url})"
                
                hotspots.append(formatted_item)
        
        print(f"Extracted {len(hotspots)} wearables-tagged hotspots", file=sys.stderr)
        return hotspots
    
    except Exception as e:
        print(f"Error extracting hotspots: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return []
