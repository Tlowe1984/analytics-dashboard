"""Enhanced helper functions to extract rich text formatting from Word documents with hyperlinks"""

def extract_rich_text_with_links(paragraph):
    """
    Extract text from a paragraph preserving bold and hyperlinks.
    Returns markdown-formatted text.
    Improved version that properly extracts hyperlinks from Word XML.
    """
    result = []
    
    # Get hyperlink map from paragraph's part relationships
    hyperlink_map = {}
    try:
        if hasattr(paragraph, 'part') and hasattr(paragraph.part, 'rels'):
            for rel_id, rel in paragraph.part.rels.items():
                if rel.reltype == 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink':
                    hyperlink_map[rel_id] = rel.target_ref
    except:
        pass
    
    # Process paragraph elements to find hyperlinks
    current_hyperlink_url = None
    hyperlink_text = []
    
    for child in paragraph._element:
        # Check if this is a hyperlink element
        if 'hyperlink' in child.tag.lower():
            # Get the relationship ID
            r_id = child.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            if r_id and r_id in hyperlink_map:
                current_hyperlink_url = hyperlink_map[r_id]
                hyperlink_text = []
                
                # Extract text from runs within hyperlink
                for run_elem in child:
                    if 't' in run_elem.tag.lower():
                        text = run_elem.text
                        if text:
                            # Check if run is bold
                            is_bold = False
                            rPr = run_elem.getparent().find('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rPr')
                            if rPr is not None:
                                bold_elem = rPr.find('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}b')
                                is_bold = bold_elem is not None
                            
                            if is_bold:
                                hyperlink_text.append(f'**{text}**')
                            else:
                                hyperlink_text.append(text)
                
                # Add formatted hyperlink
                if hyperlink_text and current_hyperlink_url:
                    link_text = ''.join(hyperlink_text)
                    result.append(f'[{link_text}]({current_hyperlink_url})')
                
                current_hyperlink_url = None
                hyperlink_text = []
    
    # Process regular runs (non-hyperlink text)
    for run in paragraph.runs:
        text = run.text
        if not text:
            continue
        
        # Check if this run is part of a hyperlink (already processed above)
        parent = run._element.getparent()
        if parent is not None and 'hyperlink' in parent.tag.lower():
            continue  # Skip, already processed
        
        # Apply bold formatting
        if run.bold:
            result.append(f'**{text}**')
        else:
            result.append(text)
    
    # Join result and clean up
    text = ''.join(result)
    
    # Remove empty parentheses from lost hyperlinks
    import re
    text = re.sub(r'\s*\(\)\s*', ' ', text)
    
    return text.strip()

def extract_rich_text_from_cell_with_links(cell):
    """
    Extract rich text from a table cell preserving bold and hyperlinks.
    Returns markdown-formatted text.
    """
    result = []
    for paragraph in cell.paragraphs:
        para_text = extract_rich_text_with_links(paragraph)
        if para_text:
            result.append(para_text)
    return ' '.join(result)

# Backward compatibility - keep old function names
def extract_rich_text(paragraph):
    """Alias for backward compatibility"""
    return extract_rich_text_with_links(paragraph)

def extract_rich_text_from_cell(cell):
    """Alias for backward compatibility"""
    return extract_rich_text_from_cell_with_links(cell)
