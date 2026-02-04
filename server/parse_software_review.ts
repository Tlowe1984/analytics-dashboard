/**
 * Parse Software (I+E, AI, Hearing) Canonical Program Review document
 * Extracts Wins, Exec Summary, and Product Decisions table
 */

import { parseDocx } from './docxParser';

interface ParsedItem {
  section_type: string;
  content?: string;
  is_new?: number;
  indent_level?: number;
  order: number;
  // Decision fields
  category?: string;
  topic?: string;
  dri?: string;
  forum?: string;
  status?: string;
  decision_doc?: string;
  decision_makers?: string;
  decision_outcome?: string;
  post?: string;
}

export async function parseSoftwareReview(docPath: string): Promise<ParsedItem[]> {
  try {
    const doc = await parseDocx(docPath);
    
    const items: ParsedItem[] = [];
    let currentSection: string | null = null;
    let order = 0;
    
    // Section markers
    const winsMarkers = ['🏆 Wins', 'Wins'];
    const execSummaryMarkers = ['🚀 Exec Summary', 'Exec Summary'];
    
    // Parse paragraphs for Wins and Exec Summary
    for (const para of doc.paragraphs) {
      const text = para.text.trim();
      
      if (!text) continue;
      
      // Check for section headers
      if (winsMarkers.some(marker => text.includes(marker))) {
        currentSection = 'wins';
        order = 0;
        continue;
      } else if (execSummaryMarkers.some(marker => text.includes(marker))) {
        currentSection = 'exec_summary';
        order = 0;
        continue;
      } else if (text.includes('Product Decisions')) {
        // Stop processing paragraphs when we hit Product Decisions
        break;
      }
      
      // Skip if we haven't found a section yet
      if (currentSection === null) continue;
      
      // Skip section headers and empty lines
      if (text.startsWith('📣') || text.startsWith('FYIs')) continue;
      if (text.startsWith('🗓️ Upcoming Releases')) break;
      if (text.startsWith('Portfolio View')) break;
      if (text.startsWith('🚩 Leadership Help Needed')) break;
      
      // Check if this is a content line (starts with bracket or bullet)
      if (text.startsWith('[') || text.startsWith('•') || text.startsWith('-') || text.startsWith('**')) {
        items.push({
          section_type: currentSection,
          content: para.richText,
          is_new: para.isBlue ? 1 : 0,
          indent_level: para.indentLevel,
          order: order++
        });
      }
    }
    
    // Parse Product Decisions table
    const decisions = parseProductDecisionsTable(doc);
    items.push(...decisions);
    
    return items;
  } catch (error) {
    console.error('Error parsing software review:', error);
    return [];
  }
}

function parseProductDecisionsTable(doc: any): ParsedItem[] {
  const decisions: ParsedItem[] = [];
  let currentCategory: string | null = null;
  
  for (const table of doc.tables) {
    if (table.rows.length < 2) continue;
    
    // Check if first row is a title row
    const firstRowCells = table.rows[0].cells.map((c: any) => c.text.trim());
    const isTitleRow = new Set(firstRowCells).size === 1 && firstRowCells[0];
    
    // Get header row
    const headerRowIdx = isTitleRow ? 1 : 0;
    if (table.rows.length <= headerRowIdx) continue;
    
    const headerRow = table.rows[headerRowIdx];
    const headers = headerRow.cells.map((c: any) => c.text.trim().toLowerCase());
    
    // Check if this looks like a decisions table
    const hasTopic = headers.some(h => h.includes('topic'));
    const hasStatus = headers.some(h => h.includes('status'));
    const hasOutcome = headers.some(h => h.includes('outcome'));
    
    if (!hasTopic && !hasStatus && !hasOutcome) continue;
    
    // Find column indices
    const colIndices: Record<string, number> = {};
    headers.forEach((header, i) => {
      if (header.includes('topic')) colIndices['topic'] = i;
      else if (header.includes('dri')) colIndices['dri'] = i;
      else if (header.includes('forum')) colIndices['forum'] = i;
      else if (header.includes('status')) colIndices['status'] = i;
      else if (header.includes('decision doc') || (header.includes('decision') && header.includes('doc'))) colIndices['decision_doc'] = i;
      else if (header.includes('decision makers') || header.includes('reviewers') || header.includes('makers')) colIndices['decision_makers'] = i;
      else if (header.includes('decision outcome') || header.includes('outcome')) colIndices['decision_outcome'] = i;
      else if (header.includes('post')) colIndices['post'] = i;
    });
    
    // Parse data rows
    const dataStartIdx = headerRowIdx + 1;
    for (let i = dataStartIdx; i < table.rows.length; i++) {
      const row = table.rows[i];
      if (row.cells.length < 3) continue;
      
      const topic = row.cells[colIndices['topic'] || 0]?.richText || '';
      
      // Check if this is a category header row
      const topicLower = topic.toLowerCase().replace(/\*/g, '').trim();
      if (topicLower.includes('pillar decisions') || topicLower.includes('fyi sub-pillar')) {
        currentCategory = topicLower.includes('fyi') ? 'FYI' : 'Pillar';
        continue;
      }
      
      // Skip empty rows
      if (!topic) continue;
      
      const dri = row.cells[colIndices['dri'] || 1]?.richText || '';
      const forum = row.cells[colIndices['forum'] || 2]?.richText || '';
      const status = row.cells[colIndices['status'] || 3]?.richText || '';
      const decision_doc = row.cells[colIndices['decision_doc'] || 4]?.richText || '';
      const decision_makers = row.cells[colIndices['decision_makers'] || 5]?.richText || '';
      const decision_outcome = row.cells[colIndices['decision_outcome'] || 6]?.richText || '';
      const post = row.cells[colIndices['post'] || 7]?.richText || '';
      
      decisions.push({
        section_type: 'decisions',
        category: currentCategory || 'Other',
        topic,
        dri,
        forum,
        status,
        decision_doc,
        decision_makers,
        decision_outcome,
        post,
        order: decisions.length
      });
    }
  }
  
  return decisions;
}


