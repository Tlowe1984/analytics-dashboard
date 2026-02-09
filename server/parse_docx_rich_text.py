#!/usr/bin/env python3
"""
Helper functions to extract rich text with formatting from Word documents.
Converts to HTML to preserve bold, hyperlinks, and nested structure.
"""

from docx import Document
from typing import List


def paragraph_to_html(para) -> str:
    """
    Convert a Word paragraph to HTML, preserving formatting.
    
    Handles:
    - Bold text
    - Hyperlinks
    - Nested bullet points (indentation levels)
    
    Returns HTML string.
    """
    html_parts = []
    
    # Check if paragraph has list style (bullet point)
    is_bullet = False
    indent_level = 0
    
    if para.style.name.startswith('List'):
        is_bullet = True
        # Try to determine indent level from style name
        if 'List Bullet 2' in para.style.name or 'List Number 2' in para.style.name:
            indent_level = 1
        elif 'List Bullet 3' in para.style.name or 'List Number 3' in para.style.name:
            indent_level = 2
    
    # Process runs and hyperlinks
    for child in para._element:
        if 'hyperlink' in child.tag:
            # Extract hyperlink
            link_id = child.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            link_url = None
            
            # Try to get URL from document relationships
            try:
                if link_id and hasattr(para._element, 'part'):
                    rels = para._element.part.rels
                    if link_id in rels:
                        link_url = rels[link_id].target_ref
            except:
                pass
            
            # Extract text from hyperlink runs
            link_text = ''
            is_bold = False
            for run_elem in child:
                if 'r' in run_elem.tag:
                    # Check if bold
                    for prop in run_elem:
                        if 'rPr' in prop.tag:
                            for style in prop:
                                if 'b' in style.tag:
                                    is_bold = True
                    
                    # Get text
                    for text_elem in run_elem:
                        if 't' in text_elem.tag and text_elem.text:
                            link_text += text_elem.text
            
            if link_text:
                if is_bold:
                    link_text = f'<strong>{link_text}</strong>'
                if link_url:
                    html_parts.append(f'<a href="{link_url}" target="_blank">{link_text}</a>')
                else:
                    html_parts.append(f'<a>{link_text}</a>')
        
        elif 'r' in child.tag:
            # Regular run (not hyperlink)
            run_text = ''
            is_bold = False
            
            # Check formatting
            for prop in child:
                if 'rPr' in prop.tag:
                    for style in prop:
                        if 'b' in style.tag:
                            is_bold = True
            
            # Get text
            for text_elem in child:
                if 't' in text_elem.tag and text_elem.text:
                    run_text += text_elem.text
            
            if run_text:
                if is_bold:
                    html_parts.append(f'<strong>{run_text}</strong>')
                else:
                    html_parts.append(run_text)
    
    # Combine parts
    content = ''.join(html_parts)
    
    # Wrap in appropriate tags
    if is_bullet:
        # Add indentation class for nested bullets
        indent_class = f' class="indent-{indent_level}"' if indent_level > 0 else ''
        return f'<li{indent_class}>{content}</li>'
    else:
        return content


def extract_rich_text_items(paragraphs: List, start_idx: int, end_idx: int, 
                            subsection_start: str, subsection_end: str = None) -> List[str]:
    """
    Extract items from a subsection with rich text formatting.
    
    Args:
        paragraphs: List of document paragraphs
        start_idx: Starting paragraph index for the section
        end_idx: Ending paragraph index for the section
        subsection_start: Regex pattern to match subsection start (e.g., "Wins")
        subsection_end: Regex pattern to match next subsection (optional)
    
    Returns:
        List of HTML-formatted strings
    """
    import re
    
    items = []
    in_subsection = False
    current_item = []
    
    for i in range(start_idx, min(end_idx, len(paragraphs))):
        para = paragraphs[i]
        text = para.text.strip()
        
        if not text:
            continue
        
        # Check if we've reached the target subsection
        if re.search(subsection_start, text, re.IGNORECASE):
            in_subsection = True
            continue
        
        # Check if we've reached the next subsection (stop)
        if subsection_end and re.search(subsection_end, text, re.IGNORECASE):
            break
        
        if in_subsection:
            # Check if this is a top-level item (starts with category or is not indented)
            is_top_level = (
                text.startswith('[') or 
                (len(text) > 20 and ':' in text[:50]) or
                not para.style.name.startswith('List')
            )
            
            if is_top_level and current_item:
                # Save previous item
                items.append(''.join(current_item))
                current_item = []
            
            # Add paragraph HTML
            html = paragraph_to_html(para)
            if html:
                current_item.append(html)
    
    # Add last item
    if current_item:
        items.append(''.join(current_item))
    
    return items[:20]  # Limit to top 20 items


if __name__ == '__main__':
    # Test with W06 document
    doc = Document('/tmp/W06 Experiences & Interfaces Review.docx')
    
    # Test AI wins section (paragraphs 102-113)
    print("Testing AI Wins extraction:")
    print("=" * 80)
    
    wins = extract_rich_text_items(
        doc.paragraphs,
        start_idx=92,  # AI section start
        end_idx=210,   # AI section end
        subsection_start=r'🏆\s*(Wins?|Launches?)',
        subsection_end=r'(🚩|Help\s+Needed)'
    )
    
    print(f"Found {len(wins)} wins")
    for i, win in enumerate(wins[:3]):
        print(f"\nWin {i+1}:")
        print(win[:200])
