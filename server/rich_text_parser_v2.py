"""Enhanced helper functions to extract rich text formatting from Word documents with hyperlinks"""

def extract_rich_text_with_links(paragraph):
    """
    Extract text from a paragraph preserving bold and hyperlinks in their original order.
    Returns markdown-formatted text.
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
    
    # Build a map of run elements to their parent hyperlinks
    run_to_hyperlink = {}
    for child in paragraph._element:
        if 'hyperlink' in child.tag.lower():
            r_id = child.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            if r_id and r_id in hyperlink_map:
                hyperlink_url = hyperlink_map[r_id]
                # Map all runs within this hyperlink
                for run_elem in child:
                    if 'r' in run_elem.tag.lower():
                        run_to_hyperlink[id(run_elem)] = hyperlink_url
    
    # Process runs in order
    current_hyperlink_url = None
    hyperlink_text = []
    
    for run in paragraph.runs:
        text = run.text
        if not text:
            continue
        
        # Check if this run is part of a hyperlink
        run_elem_id = id(run._element)
        is_in_hyperlink = run_elem_id in run_to_hyperlink
        
        if is_in_hyperlink:
            hyperlink_url = run_to_hyperlink[run_elem_id]
            
            # If starting a new hyperlink, flush the previous one
            if current_hyperlink_url and current_hyperlink_url != hyperlink_url:
                if hyperlink_text:
                    link_text = ''.join(hyperlink_text)
                    result.append(f'[{link_text}]({current_hyperlink_url})')
                    hyperlink_text = []
            
            current_hyperlink_url = hyperlink_url
            
            # Add text to hyperlink buffer
            if run.bold:
                hyperlink_text.append(f'**{text}**')
            else:
                hyperlink_text.append(text)
        else:
            # Not in hyperlink - flush any pending hyperlink first
            if current_hyperlink_url and hyperlink_text:
                link_text = ''.join(hyperlink_text)
                result.append(f'[{link_text}]({current_hyperlink_url})')
                hyperlink_text = []
                current_hyperlink_url = None
            
            # Add regular text
            if run.bold:
                result.append(f'**{text}**')
            else:
                result.append(text)
    
    # Flush any remaining hyperlink
    if current_hyperlink_url and hyperlink_text:
        link_text = ''.join(hyperlink_text)
        result.append(f'[{link_text}]({current_hyperlink_url})')
    
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
