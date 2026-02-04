/**
 * Parse Wearable Systems Review document
 * Extracts Wins, Exec Summary, and Help Needed sections
 */

import { parseDocx } from './docxParser';

interface ParsedItem {
  section_type: string;
  content: string;
  is_new: number;
  indent_level: number;
  order: number;
}

export async function parseSystemsReview(docPath: string): Promise<ParsedItem[]> {
  try {
    const doc = await parseDocx(docPath);
    
    const items: ParsedItem[] = [];
    let currentSection: string | null = null;
    let order = 0;
    
    // Section markers
    const winsMarkers = ['🏆 Wins', 'Wins [Async]'];
    const execSummaryMarkers = ['🚀 Exec Summary', 'Exec Summary [Async]'];
    const helpNeededMarkers = ['🆘 Help Needed', 'Help Needed / Flag for Leadership'];
    
    for (const para of doc.paragraphs) {
      const text = para.text.trim();
      
      if (!text) continue;
      
      // Check for section headers
      if (winsMarkers.some(marker => text.includes(marker))) {
        currentSection = 'wins';
        continue;
      } else if (execSummaryMarkers.some(marker => text.includes(marker))) {
        currentSection = 'exec_summary';
        continue;
      } else if (helpNeededMarkers.some(marker => text.includes(marker))) {
        currentSection = 'help_needed';
        continue;
      }
      
      // Skip if we haven't entered a section yet
      if (currentSection === null) continue;
      
      // Skip short lines, all caps, or emoji-only lines (sub-headers)
      if (text.length < 10 || text === text.toUpperCase() || /^[⚠️🔴✅🎯🎉🆘🏆🚀 ]+$/.test(text)) {
        continue;
      }
      
      // Add the item
      items.push({
        section_type: currentSection,
        content: para.richText,
        is_new: para.isBlue ? 1 : 0,
        indent_level: para.indentLevel,
        order: order++
      });
    }
    
    return items;
  } catch (error) {
    console.error('Error parsing systems review:', error);
    return [];
  }
}


