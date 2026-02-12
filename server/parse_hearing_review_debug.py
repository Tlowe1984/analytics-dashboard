#!/home/ubuntu/analytics-dashboard/venv/bin/python3
import sys
from docx import Document

docx_path = sys.argv[1]
doc = Document(docx_path)

current_section = None
table_count = 0
decisions_table_count = 0

for element in doc.element.body:
    if element.tag.endswith('p'):
        para_text = ''.join([node.text for node in element.iter() if hasattr(node, 'text') and node.text is not None]).strip()
        text_lower = para_text.lower()
        
        if 'decisions' in text_lower and len(para_text) < 30:
            current_section = 'decisions'
            print(f'✓ Found Decisions section: "{para_text}"')
    
    elif element.tag.endswith('tbl'):
        table_count += 1
        
        # Find the table object
        table = None
        for t in doc.tables:
            if t._element == element:
                table = t
                break
        
        if table is None:
            print(f'✗ Table {table_count}: Could not find table object')
            continue
        
        if current_section != 'decisions':
            print(f'✗ Table {table_count}: Not in decisions section (current: {current_section})')
            continue
        
        # Check if this is the Health Decisions table
        if len(table.rows) > 0:
            first_cell_text = table.rows[0].cells[0].text.strip()
            print(f'✓ Table {table_count} in decisions section: "{first_cell_text[:60]}"')
            
            if 'Health Decisions' not in first_cell_text:
                print(f'  ✗ Skipping (not Health Decisions table)')
                continue
            
            print(f'  ✓ This is the Health Decisions table!')
            print(f'  Rows: {len(table.rows)}, Columns: {len(table.rows[0].cells)}')
            decisions_table_count += 1
            
            # Check first data row
            if len(table.rows) > 2:
                print(f'  Row 2 (first data row):')
                for i in range(min(7, len(table.rows[2].cells))):
                    text = table.rows[2].cells[i].text.strip()[:40]
                    print(f'    Col {i}: "{text}"')

print(f'\nSummary:')
print(f'Total tables: {table_count}')
print(f'Health Decisions tables found: {decisions_table_count}')
