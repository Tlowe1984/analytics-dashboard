#!/usr/bin/env python3.11
import json
import sys
from docx import Document
from rich_text_parser_v2 import extract_rich_text

if len(sys.argv) < 2:
    print(json.dumps([]))
    sys.exit(0)

doc_path = sys.argv[1]

try:
    doc = Document(doc_path)
    
    items = []
    current_product = None
    current_section = None
    in_exec_summary = False
    
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        
        # Check if we're in Topline section (first tab)
        # Use exact match to avoid false positives like "Topline Scorecard metrics" in content
        if text == 'Topline' or text == 'Top Line' or text == 'Topline View':
            in_exec_summary = True
            # For Topline, set product to 'general' to capture top-level Highlights/Risks
            current_product = 'general'
            continue
        
        # Stop if we hit another major section
        if text == 'Hotspots' or text == 'Decisions' or text == 'Exec Summary' or text == 'Executive Summary':
            break
        
        if not in_exec_summary:
            continue
        
        # Detect product-specific sections within Topline
        if text in ['AI Glasses', 'Wrist', 'ARG/SSG', 'ARG / SSG', 'In-Market', 'In Market']:
            # Map to product categories
            if text == 'AI Glasses':
                current_product = 'ai_glasses'
            elif text == 'Wrist':
                current_product = 'wrist'
            elif text in ['ARG/SSG', 'ARG / SSG']:
                current_product = 'arg_ssg'
            elif text in ['In-Market', 'In Market']:
                current_product = 'in_market'
            current_section = None  # Reset section when entering new product
            continue
        
        # Detect section types (match exact or prefix)
        if text in ['Highlights', 'Risks/Opens', 'Upcoming'] or text.startswith('Highlights') or text.startswith('Risks') or text.startswith('Upcoming'):
            # Map to canonical section names
            if text.startswith('Highlights') or text == 'Highlights':
                current_section = 'highlights'
            elif text.startswith('Risks') or text == 'Risks/Opens':
                current_section = 'risks'
            elif text.startswith('Upcoming') or text == 'Upcoming':
                current_section = 'upcoming'
            continue
        
        # Skip if we don't have both product and section
        if not current_product or not current_section:
            continue
        
        # Check if text is blue (new information)
        is_new = False
        for run in para.runs:
            if run.font.color and run.font.color.rgb:
                r, g, b = run.font.color.rgb
                # Check if color is blue-ish (more blue than red/green)
                if b > 150 and b > r and b > g:
                    is_new = True
                    break
        
        # Get numbering level for indentation
        # Level 0: Product (AI Glasses, Wrist, ARG/SSG)
        # Level 1: Section (Highlights, Risks/Opens, Upcoming)
        # Level 2: Main bullets (should be flush left, indent_level=0)
        # Level 3+: Sub-bullets (should be indented, indent_level=1+)
        indent_level = 0
        numbering_part = para._element.pPr.numPr if para._element.pPr is not None and hasattr(para._element.pPr, 'numPr') else None
        if numbering_part is not None and numbering_part.ilvl is not None:
            doc_level = numbering_part.ilvl.val
            # Map document levels to UI indent levels
            # doc_level 0,1,2 -> indent_level 0 (flush left)
            # doc_level 3+ -> indent_level 1+ (indented)
            if doc_level >= 3:
                indent_level = doc_level - 2
        
        # Extract rich text with bold and links
        rich_content = extract_rich_text(para)
        
        # Detect and strip [wearables-tag]
        is_wearables_tag = '[wearables-tag]' in rich_content.lower()
        if is_wearables_tag:
            # Remove [wearables-tag] (case insensitive)
            import re
            rich_content = re.sub(r'\[wearables-tag\]', '', rich_content, flags=re.IGNORECASE).strip()
        
        # Intelligent categorization: detect risks in content even if under Highlights section
        # Only recategorize if the item is ITSELF a risk, not merely reporting/mentioning risk topics
        # IMPORTANT: Use a LOCAL effective_section variable - never mutate current_section here,
        # as that would corrupt the section state for all subsequent items in the same product.
        content_lower = rich_content.lower()
        
        # Strong risk indicators - these almost always mean the item IS a risk
        strong_risk_indicators = [
            'mrbd risks', 'mrbd risk', 'risks/opens',
            '🔴', '🚨', '❌',
            'not meeting criteria', 'behind schedule', 'at risk',
            'we are concerned', 'still aiming', 'punted if not',
        ]
        
        # Phrase-level risk patterns (require surrounding context, not just a word)
        # These avoid false positives like "report top-SEV/issues" or "track blockers"
        phrase_risk_patterns = [
            'but 5 days delayed', 'but delayed', 'declared, but',
            'kpis may not be', 'p90 numbers are concerning',
            'will be punted', 'not complete by',
        ]
        
        # Positive highlight signals - if present, do NOT recategorize as risk
        # (handles mixed-content paragraphs that mention both ⚠️ and 🎉)
        positive_indicators = ['🎉', '✅', '🏆', '🥇', '🌟', '⭐']
        
        is_strong_risk = any(ind in content_lower for ind in strong_risk_indicators)
        is_phrase_risk = any(pat in content_lower for pat in phrase_risk_patterns)
        has_positive_signal = any(ind in rich_content for ind in positive_indicators)
        
        # Determine effective section for THIS item only (never mutate current_section)
        effective_section = current_section
        if current_section == 'highlights' and (is_strong_risk or is_phrase_risk) and not has_positive_signal:
            effective_section = 'risks'
        
        # Add the item
        items.append({
            'product': current_product,
            'section': effective_section,
            'content': rich_content,
            'is_new': 1 if is_new else 0,
            'is_wearables_tag': 1 if is_wearables_tag else 0,
            'indent_level': indent_level
        })
    
    print(json.dumps(items))
except Exception as e:
    print(json.dumps([]), file=sys.stderr)
    sys.exit(1)
