"""
Extract decision tables from Word documents with rich text formatting
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from rich_text_parser_v2 import extract_rich_text_with_links

def extract_decision_table(doc, table_keywords):
    """
    Extract decision table from document based on keywords in header
    
    Args:
        doc: python-docx Document object
        table_keywords: List of keywords to identify the decision table (e.g., ['AI', 'Decision'])
    
    Returns:
        List of decision dictionaries with fields: topic, dri, forum, status, 
        decision_doc, decision_makers, decision_outcome, post
    """
    decisions = []
    
    for table in doc.tables:
        if len(table.rows) < 2:
            continue
        
        # Check if this is a decision table by looking at header row
        header_text = ' '.join([cell.text.strip() for cell in table.rows[0].cells]).lower()
        
        # Check if all keywords are in header
        if not all(keyword.lower() in header_text for keyword in table_keywords):
            continue
        
        # Extract column headers - check both row 0 and row 1 for actual headers
        # Row 0 might be a merged header, row 1 has actual column names
        headers_row_0 = [cell.text.strip().lower() for cell in table.rows[0].cells]
        headers_row_1 = [cell.text.strip().lower() for cell in table.rows[1].cells] if len(table.rows) > 1 else []
        
        # Use row 1 if it has distinct column names (not all the same)
        if headers_row_1 and len(set(headers_row_1)) > 1:
            headers = headers_row_1
            data_start_row = 2  # Data starts from row 2
        else:
            headers = headers_row_0
            data_start_row = 1  # Data starts from row 1
        
        # Map column names to field names (handle variations)
        column_map = {}
        for idx, header in enumerate(headers):
            if 'topic' in header:
                column_map['topic'] = idx
            elif 'dri' in header:
                column_map['dri'] = idx
            elif 'forum' in header:
                column_map['forum'] = idx
            elif 'status' in header:
                column_map['status'] = idx
            elif 'decision doc' in header or 'decision' in header and 'doc' in header:
                column_map['decision_doc'] = idx
            elif 'decision maker' in header or 'decisions maker' in header:
                column_map['decision_makers'] = idx
            elif 'decision outcome' in header or 'outcome' in header or 'steer' in header:
                column_map['decision_outcome'] = idx
            elif 'post' in header:
                column_map['post'] = idx
        
        # Extract data rows (skip header rows)
        for row_idx in range(data_start_row, len(table.rows)):
            row = table.rows[row_idx]
            cells = row.cells
            
            # Extract data with rich text formatting
            decision = {}
            
            # Topic (if no topic column, use first column or decision_doc)
            if 'topic' in column_map:
                decision['topic'] = extract_rich_text_with_links(cells[column_map['topic']].paragraphs[0]) if len(cells[column_map['topic']].paragraphs) > 0 else ''
            elif 'decision_doc' in column_map:
                decision['topic'] = extract_rich_text_with_links(cells[column_map['decision_doc']].paragraphs[0]) if len(cells[column_map['decision_doc']].paragraphs) > 0 else ''
            else:
                decision['topic'] = extract_rich_text_with_links(cells[0].paragraphs[0]) if len(cells[0].paragraphs) > 0 else ''
            
            # DRI
            if 'dri' in column_map:
                decision['dri'] = extract_rich_text_with_links(cells[column_map['dri']].paragraphs[0]) if len(cells[column_map['dri']].paragraphs) > 0 else ''
            else:
                decision['dri'] = ''
            
            # Forum
            if 'forum' in column_map:
                decision['forum'] = extract_rich_text_with_links(cells[column_map['forum']].paragraphs[0]) if len(cells[column_map['forum']].paragraphs) > 0 else ''
            else:
                decision['forum'] = ''
            
            # Status
            if 'status' in column_map:
                decision['status'] = extract_rich_text_with_links(cells[column_map['status']].paragraphs[0]) if len(cells[column_map['status']].paragraphs) > 0 else ''
            else:
                decision['status'] = ''
            
            # Decision Doc
            if 'decision_doc' in column_map:
                decision['decision_doc'] = extract_rich_text_with_links(cells[column_map['decision_doc']].paragraphs[0]) if len(cells[column_map['decision_doc']].paragraphs) > 0 else ''
            else:
                decision['decision_doc'] = ''
            
            # Decision Makers - extract all paragraphs
            if 'decision_makers' in column_map:
                cell = cells[column_map['decision_makers']]
                paragraphs_text = []
                for para in cell.paragraphs:
                    text = extract_rich_text_with_links(para)
                    if text.strip():
                        paragraphs_text.append(text)
                decision['decision_makers'] = '\n\n'.join(paragraphs_text) if paragraphs_text else ''
            else:
                decision['decision_makers'] = ''
            
            # Decision Outcome - extract all paragraphs
            if 'decision_outcome' in column_map:
                cell = cells[column_map['decision_outcome']]
                paragraphs_text = []
                for para in cell.paragraphs:
                    text = extract_rich_text_with_links(para)
                    if text.strip():
                        paragraphs_text.append(text)
                decision['decision_outcome'] = '\n\n'.join(paragraphs_text) if paragraphs_text else ''
            else:
                decision['decision_outcome'] = ''
            
            # Post
            if 'post' in column_map:
                decision['post'] = extract_rich_text_with_links(cells[column_map['post']].paragraphs[0]) if len(cells[column_map['post']].paragraphs) > 0 else ''
            else:
                decision['post'] = ''
            
            # Skip header rows and empty rows
            topic_text = decision.get('topic', '').strip()
            if not topic_text:
                continue
            # Skip if topic is a header keyword
            if topic_text.lower() in ['topic', '**topic**', 'dri', '**dri**', 'forum', 'status']:
                continue
            # Skip if topic starts with ** and ends with ** (likely a header)
            if topic_text.startswith('**') and topic_text.endswith('**') and len(topic_text) < 30:
                continue
            
            # Only add if has meaningful content
            if decision.get('topic') or decision.get('decision_doc') or decision.get('decision_outcome'):
                decisions.append(decision)
        
        # Found the decision table, return results
        if decisions:
            return decisions
    
    return []

def extract_ie_decisions(doc):
    """Extract Experiences & Interfaces decisions"""
    return extract_decision_table(doc, ['I+E', 'Decision'])

def extract_ai_decisions(doc):
    """Extract AI decisions"""
    return extract_decision_table(doc, ['AI', 'Decision'])

def extract_hearing_decisions(doc):
    """Extract Hearing decisions"""
    return extract_decision_table(doc, ['Hearing', 'Decision'])
