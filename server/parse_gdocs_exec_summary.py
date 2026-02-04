#!/usr/bin/env python3
"""
Google Docs API parser for Exec Summary with hyperlink and bold preservation.
Replaces Word-based parser to preserve formatting lost in Google Docs → Word export.
"""
import json
import sys
import os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

def extract_text_from_paragraph(paragraph):
    """
    Extract text from a paragraph preserving bold and hyperlinks.
    Returns markdown-formatted text.
    """
    if 'elements' not in paragraph:
        return ''
    
    result = []
    for element in paragraph['elements']:
        if 'textRun' not in element:
            continue
        
        text_run = element['textRun']
        text = text_run.get('content', '')
        
        if not text or text == '\n':
            continue
        
        text_style = text_run.get('textStyle', {})
        
        # Check for hyperlink
        link = text_style.get('link', {}).get('url')
        # Check for bold
        is_bold = text_style.get('bold', False)
        
        # Apply formatting
        if link:
            # Hyperlink with optional bold
            if is_bold:
                result.append(f'[**{text.strip()}**]({link})')
            else:
                result.append(f'[{text.strip()}]({link})')
        elif is_bold:
            result.append(f'**{text.strip()}**')
        else:
            result.append(text.strip())
    
    return ' '.join(result)

def get_indent_level(paragraph):
    """Get indentation level from paragraph style."""
    if 'bullet' not in paragraph:
        return 0
    
    nesting_level = paragraph['bullet'].get('nestingLevel', 0)
    
    # Map Google Docs nesting levels to UI indent levels
    # Level 0-2 -> indent_level 0 (flush left)
    # Level 3+ -> indent_level 1+ (indented)
    if nesting_level >= 3:
        return nesting_level - 2
    return 0

def check_blue_text(paragraph):
    """Check if paragraph contains blue text (new information)."""
    if 'elements' not in paragraph:
        return False
    
    for element in paragraph['elements']:
        if 'textRun' not in element:
            continue
        
        text_style = element['textRun'].get('textStyle', {})
        fg_color = text_style.get('foregroundColor', {}).get('color', {}).get('rgbColor', {})
        
        if fg_color:
            r = fg_color.get('red', 0) * 255
            g = fg_color.get('green', 0) * 255
            b = fg_color.get('blue', 0) * 255
            
            # Check if color is blue-ish (more blue than red/green)
            if b > 150 and b > r and b > g:
                return True
    
    return False

def parse_exec_summary(doc_id, credentials_json):
    """Parse Exec Summary from Google Docs."""
    try:
        # Load credentials from JSON
        creds_data = json.loads(credentials_json)
        creds = Credentials.from_authorized_user_info(creds_data)
        
        # Build Google Docs API service
        service = build('docs', 'v1', credentials=creds)
        
        # Get document
        document = service.documents().get(documentId=doc_id).execute()
        
        items = []
        current_product = None
        current_section = None
        in_exec_summary = False
        
        # Parse document content
        for element in document.get('body', {}).get('content', []):
            if 'paragraph' not in element:
                continue
            
            paragraph = element['paragraph']
            text = extract_text_from_paragraph(paragraph).strip()
            
            if not text:
                continue
            
            # Check if we're in Exec Summary section
            if 'Exec Summary' in text:
                in_exec_summary = True
                continue
            
            # Stop if we hit another major section
            if 'Hotspots' in text or 'Decisions' in text:
                break
            
            if not in_exec_summary:
                continue
            
            # Detect product categories
            if text in ['AI Glasses', 'Wrist', 'ARG/SSG', 'ARG / SSG']:
                current_product = text.replace(' / ', '_').replace('/', '_').replace(' ', '_').lower()
                if current_product == 'arg_ssg':
                    current_product = 'arg_ssg'
                continue
            
            # Detect section types
            if text in ['Highlights', 'Risks/Opens', 'Upcoming']:
                current_section = text.lower().replace('/', '_').replace(' ', '_')
                if current_section == 'risks_opens':
                    current_section = 'risks'
                continue
            
            # Skip if we don't have both product and section
            if not current_product or not current_section:
                continue
            
            # Check if text is blue (new information)
            is_new = check_blue_text(paragraph)
            
            # Get indentation level
            indent_level = get_indent_level(paragraph)
            
            # Add the item
            items.append({
                'product': current_product,
                'section': current_section,
                'content': text,
                'is_new': 1 if is_new else 0,
                'indent_level': indent_level
            })
        
        return items
    
    except HttpError as error:
        print(f'An error occurred: {error}', file=sys.stderr)
        return []
    except Exception as e:
        print(f'Error: {e}', file=sys.stderr)
        return []

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps([]))
        sys.exit(0)
    
    doc_id = sys.argv[1]
    credentials_json = sys.argv[2]
    
    items = parse_exec_summary(doc_id, credentials_json)
    print(json.dumps(items))
