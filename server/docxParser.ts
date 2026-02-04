/**
 * Shared DOCX parsing utilities for Node.js
 * Replaces python-docx functionality using pizzip + xml2js
 */

import * as fs from 'fs';
import PizZip from 'pizzip';
import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXml = promisify(parseString);

export interface DocxDocument {
  paragraphs: DocxParagraph[];
  tables: DocxTable[];
  hyperlinks: Map<string, string>;
}

export interface DocxParagraph {
  text: string;
  runs: DocxRun[];
  isBlue: boolean;
  indentLevel: number;
  richText: string;
}

export interface DocxRun {
  text: string;
  isBold: boolean;
  isBlue: boolean;
}

export interface DocxTable {
  rows: DocxRow[];
}

export interface DocxRow {
  cells: DocxCell[];
}

export interface DocxCell {
  text: string;
  richText: string;
  paragraphs: DocxParagraph[];
}

/**
 * Parse a DOCX file and return structured document
 */
export async function parseDocx(docPath: string): Promise<DocxDocument> {
  const content = fs.readFileSync(docPath);
  const zip = new PizZip(content);
  
  // Extract document.xml
  const documentXml = zip.file('word/document.xml')?.asText();
  if (!documentXml) {
    throw new Error('Could not find document.xml');
  }
  
  // Extract relationships for hyperlinks
  const relsXml = zip.file('word/_rels/document.xml.rels')?.asText();
  const hyperlinks = new Map<string, string>();
  
  if (relsXml) {
    const relsData = await parseXml(relsXml);
    const relationships = relsData?.Relationships?.Relationship || [];
    for (const rel of relationships) {
      if (rel.$?.Type === 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink') {
        hyperlinks.set(rel.$.Id, rel.$.Target);
      }
    }
  }
  
  // Parse document XML
  const docData = await parseXml(documentXml);
  const body = docData?.['w:document']?.['w:body']?.[0] || {};
  
  // Parse paragraphs
  const paragraphs: DocxParagraph[] = [];
  const paragraphElements = body['w:p'] || [];
  
  for (const paraElement of paragraphElements) {
    const paragraph = parseParagraph(paraElement, hyperlinks);
    paragraphs.push(paragraph);
  }
  
  // Parse tables
  const tables: DocxTable[] = [];
  const tableElements = body['w:tbl'] || [];
  
  for (const tableElement of tableElements) {
    const table = parseTable(tableElement, hyperlinks);
    tables.push(table);
  }
  
  return { paragraphs, tables, hyperlinks };
}

/**
 * Parse a paragraph element
 */
function parseParagraph(paraElement: any, hyperlinks: Map<string, string>): DocxParagraph {
  // Extract plain text
  const textParts: string[] = [];
  const runs: DocxRun[] = [];
  let isBlue = false;
  
  // Process runs
  const runElements = paraElement['w:r'] || [];
  for (const runElement of runElements) {
    const textElements = runElement['w:t'] || [];
    const runText = textElements.map((t: any) => t._ || t).join('');
    
    if (runText) {
      textParts.push(runText);
      
      // Check formatting
      const rPr = runElement['w:rPr']?.[0];
      const isBold = rPr?.['w:b'] !== undefined;
      
      // Check color
      const color = rPr?.['w:color']?.[0]?.$?.['w:val'];
      const runIsBlue = checkBlueColor(color);
      if (runIsBlue) isBlue = true;
      
      runs.push({
        text: runText,
        isBold,
        isBlue: runIsBlue
      });
    }
  }
  
  const text = textParts.join('');
  
  // Get indent level
  const indentLevel = getIndentLevel(paraElement);
  
  // Extract rich text
  const richText = extractRichText(paraElement, hyperlinks);
  
  return {
    text,
    runs,
    isBlue,
    indentLevel,
    richText
  };
}

/**
 * Parse a table element
 */
function parseTable(tableElement: any, hyperlinks: Map<string, string>): DocxTable {
  const rows: DocxRow[] = [];
  const rowElements = tableElement['w:tr'] || [];
  
  for (const rowElement of rowElements) {
    const cells: DocxCell[] = [];
    const cellElements = rowElement['w:tc'] || [];
    
    for (const cellElement of cellElements) {
      const paragraphs: DocxParagraph[] = [];
      const paraElements = cellElement['w:p'] || [];
      
      for (const paraElement of paraElements) {
        paragraphs.push(parseParagraph(paraElement, hyperlinks));
      }
      
      const text = paragraphs.map(p => p.text).join(' ').trim();
      const richText = paragraphs.map(p => p.richText).filter(t => t).join(' ').trim();
      
      cells.push({ text, richText, paragraphs });
    }
    
    rows.push({ cells });
  }
  
  return { rows };
}

/**
 * Extract rich text with bold and hyperlinks
 */
function extractRichText(paraElement: any, hyperlinks: Map<string, string>): string {
  const result: string[] = [];
  
  // Process hyperlinks
  const hyperlinkElements = paraElement['w:hyperlink'] || [];
  for (const hyperlink of hyperlinkElements) {
    const rId = hyperlink.$?.['r:id'];
    const url = rId ? hyperlinks.get(rId) || '' : '';
    
    const linkTextParts: string[] = [];
    const runs = hyperlink['w:r'] || [];
    
    for (const run of runs) {
      const textElements = run['w:t'] || [];
      const runText = textElements.map((t: any) => t._ || t).join('');
      
      if (runText) {
        const isBold = run['w:rPr']?.[0]?.['w:b'] !== undefined;
        linkTextParts.push(isBold ? `**${runText}**` : runText);
      }
    }
    
    if (linkTextParts.length > 0) {
      const linkText = linkTextParts.join('');
      result.push(url ? `[${linkText}](${url})` : linkText);
    }
  }
  
  // Process regular runs
  const runElements = paraElement['w:r'] || [];
  for (const run of runElements) {
    const textElements = run['w:t'] || [];
    const runText = textElements.map((t: any) => t._ || t).join('');
    
    if (runText) {
      const isBold = run['w:rPr']?.[0]?.['w:b'] !== undefined;
      result.push(isBold ? `**${runText}**` : runText);
    }
  }
  
  let text = result.join('');
  text = text.replace(/\s*\(\)\s*/g, ' '); // Remove empty parentheses
  return text.trim();
}

/**
 * Check if color is blue
 */
function checkBlueColor(colorHex: string | undefined): boolean {
  if (!colorHex) return false;
  
  try {
    const r = parseInt(colorHex.substring(0, 2), 16);
    const g = parseInt(colorHex.substring(2, 4), 16);
    const b = parseInt(colorHex.substring(4, 6), 16);
    
    return b > 150 && b > r && b > g;
  } catch {
    return false;
  }
}

/**
 * Get indent level from paragraph numbering
 */
function getIndentLevel(paraElement: any): number {
  const numPr = paraElement['w:pPr']?.[0]?.['w:numPr']?.[0];
  if (numPr && numPr['w:ilvl']) {
    const docLevel = parseInt(numPr['w:ilvl'][0].$['w:val']);
    // Map document levels to UI indent levels
    return docLevel >= 3 ? docLevel - 2 : 0;
  }
  return 0;
}
