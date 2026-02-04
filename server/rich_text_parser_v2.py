"""Enhanced helper functions to extract rich text formatting from Word documents with hyperlinks"""

def extract_rich_text_with_links(paragraph):
    """
    Extract text from a paragraph preserving bold and hyperlinks in their original order.
    Returns markdown-formatted text.
    """
    from lxml import etree
    
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
    
    # Process the paragraph XML directly to preserve order
    for element in paragraph._element:
        # Handle hyperlinks
        if element.tag.endswith('}hyperlink'):
            # Get the hyperlink URL
            r_id = element.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            hyperlink_url = hyperlink_map.get(r_id, '')
            
            # Extract text from all runs within the hyperlink
            link_text_parts = []
            for run_elem in element.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}r'):
                # Get text from this run
                text_elems = run_elem.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t')
                run_text = ''.join(t.text or '' for t in text_elems)
                
                if run_text:
                    # Check if bold
                    is_bold = False
                    rpr = run_elem.find('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rPr')
                    if rpr is not None:
                        bold_elem = rpr.find('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}b')
                        is_bold = bold_elem is not None
                    
                    if is_bold:
                        link_text_parts.append(f'**{run_text}**')
                    else:
                        link_text_parts.append(run_text)
            
            # Add the complete hyperlink in markdown format
            if link_text_parts:
                link_text = ''.join(link_text_parts)
                if hyperlink_url:
                    result.append(f'[{link_text}]({hyperlink_url})')
                else:
                    result.append(link_text)
        
        # Handle regular runs (not in hyperlinks)
        elif element.tag.endswith('}r'):
            # Get text from this run
            text_elems = element.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t')
            run_text = ''.join(t.text or '' for t in text_elems)
            
            if run_text:
                # Check if bold
                is_bold = False
                rpr = element.find('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rPr')
                if rpr is not None:
                    bold_elem = rpr.find('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}b')
                    is_bold = bold_elem is not None
                
                if is_bold:
                    result.append(f'**{run_text}**')
                else:
                    result.append(run_text)
    
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
