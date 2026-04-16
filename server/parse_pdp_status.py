#!/usr/bin/env python3
"""Parse PDP Status table from Devices & Growth Canonical Program Review doc."""
import json
import sys
from docx import Document
from docx.oxml.ns import qn


def get_hyperlinks(doc):
    """Build a map of relationship ID -> URL from the document's relationships."""
    rels = {}
    for rel in doc.part.rels.values():
        if "hyperlink" in rel.reltype:
            rels[rel.rId] = rel._target
    return rels


def get_cell_text_and_link(cell_elem, rels):
    """Extract text and hyperlink URL from a table cell element."""
    text_parts = []
    link_url = None

    for child in cell_elem.iter():
        tag = child.tag.split('}')[-1]
        if tag == 'hyperlink':
            r_id = child.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            if r_id and r_id in rels:
                link_url = rels[r_id]
        elif tag == 't':
            if child.text:
                text_parts.append(child.text)

    return ''.join(text_parts).strip(), link_url


def parse_pdp_status(docx_path):
    """Parse the PDP Status table from the document."""
    doc = Document(docx_path)
    rels = get_hyperlinks(doc)

    in_pdp = False
    rows_data = []

    for block in doc.element.body:
        tag = block.tag.split('}')[-1]

        if tag == 'p':
            text = ''.join(r.text or '' for r in block.findall('.//' + qn('w:t')))
            if 'PDP Status' in text or 'PDP status' in text:
                in_pdp = True

        elif tag == 'tbl' and in_pdp:
            rows = block.findall('.//' + qn('w:tr'))
            for i, row in enumerate(rows):
                if i == 0:
                    # Skip header row
                    continue
                cells = row.findall('.//' + qn('w:tc'))
                if len(cells) < 2:
                    continue

                pdp_gate, _ = get_cell_text_and_link(cells[0], rels)
                status_plan, _ = get_cell_text_and_link(cells[1], rels)
                critical_topics = ''
                link_text = ''
                link_url = None

                if len(cells) >= 3:
                    critical_topics, _ = get_cell_text_and_link(cells[2], rels)
                if len(cells) >= 4:
                    link_text, link_url = get_cell_text_and_link(cells[3], rels)

                if not pdp_gate.strip():
                    continue

                rows_data.append({
                    'pdp_gate': pdp_gate.strip(),
                    'status_plan': status_plan.strip(),
                    'critical_topics': critical_topics.strip(),
                    'link_text': link_text.strip(),
                    'link_url': link_url or '',
                    'sort_order': i - 1,
                })

            # Only parse the first table after PDP Status heading
            break

    return rows_data


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: parse_pdp_status.py <docx_path>", file=sys.stderr)
        sys.exit(1)

    docx_path = sys.argv[1]
    rows = parse_pdp_status(docx_path)
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    print(f"Parsed {len(rows)} PDP status rows", file=sys.stderr)
