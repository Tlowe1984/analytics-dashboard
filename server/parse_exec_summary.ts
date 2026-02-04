/**
 * Parse Exec Summary from Decisions document
 * Extracts Highlights, Risks/Opens, and Upcoming sections for each product
 */

import { parseDocx } from './docxParser';

interface ParsedItem {
  product: string;
  section: string;
  content: string;
  is_new: number;
  indent_level: number;
}

export async function parseExecSummary(docPath: string): Promise<ParsedItem[]> {
  try {
    const doc = await parseDocx(docPath);
    
    const items: ParsedItem[] = [];
    let currentProduct: string | null = null;
    let currentSection: string | null = null;
    let inExecSummary = false;
    
    for (const para of doc.paragraphs) {
      const text = para.text.trim();
      
      if (!text) continue;
      
      // Check if we're in Exec Summary section
      if (text.includes('Exec Summary')) {
        inExecSummary = true;
        continue;
      }
      
      // Stop if we hit another major section
      if (text === 'Hotspots' || (text === 'Decisions' && !currentProduct)) {
        break;
      }
      
      if (!inExecSummary) continue;
      
      // Detect product categories
      if (['AI Glasses', 'Wrist', 'ARG/SSG', 'ARG / SSG'].includes(text)) {
        currentProduct = text.replace(' / ', '_').replace('/', '_').replace(' ', '_').toLowerCase();
        if (currentProduct === 'arg_ssg') {
          currentProduct = 'arg_ssg';
        }
        continue;
      }
      
      // Detect section types
      if (text === 'Highlights' || text.startsWith('Highlights')) {
        currentSection = 'highlights';
        continue;
      } else if (text === 'Risks/Opens' || text.startsWith('Risks')) {
        currentSection = 'risks';
        continue;
      } else if (text === 'Upcoming' || text.startsWith('Upcoming')) {
        currentSection = 'upcoming';
        continue;
      }
      
      // Skip if we don't have both product and section
      if (!currentProduct || !currentSection) continue;
      
      // Add the item
      items.push({
        product: currentProduct,
        section: currentSection,
        content: para.richText,
        is_new: para.isBlue ? 1 : 0,
        indent_level: para.indentLevel
      });
    }
    
    return items;
  } catch (error) {
    console.error('Error parsing exec summary:', error);
    return [];
  }
}


