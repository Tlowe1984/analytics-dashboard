"""Helper functions to extract rich text formatting from Word documents"""

def extract_rich_text(paragraph):
    """
    Extract text from a paragraph preserving bold and hyperlinks.
    Returns markdown-formatted text.
    """
    result = []
    
    for run in paragraph.runs:
        text = run.text
        if not text:
            continue
        
        # Check if this run is part of a hyperlink
        # Hyperlinks in Word are stored in the paragraph's hyperlink relationships
        is_link = False
        link_url = None
        
        # Check if run has a hyperlink
        if run._element.rPr is not None:
            for child in run._element.rPr:
                if 'hyperlink' in child.tag.lower():
                    is_link = True
                    break
        
        # Check parent for hyperlink
        parent = run._element.getparent()
        if parent is not None and 'hyperlink' in parent.tag.lower():
            is_link = True
            # Try to get the URL from the relationship
            r_id = parent.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            if r_id:
                try:
                    link_url = paragraph.part.rels[r_id].target_ref
                except:
                    pass
        
        # Apply formatting
        if is_link and link_url:
            result.append(f'[{text}]({link_url})')
        elif run.bold:
            result.append(f'**{text}**')
        else:
            result.append(text)
    
    return ''.join(result)

def extract_rich_text_from_cell(cell):
    """
    Extract rich text from a table cell preserving bold and hyperlinks.
    Returns markdown-formatted text.
    """
    result = []
    for paragraph in cell.paragraphs:
        para_text = extract_rich_text(paragraph)
        if para_text:
            result.append(para_text)
    return ' '.join(result)
