/**
 * scheduledSync.ts
 *
 * Node.js-native sync for the analytics dashboard.
 * Uses GOOGLE_WORKSPACE_CLI_TOKEN (Bearer token) to call Google Drive API v3 directly.
 * Parses .docx files with JSZip + xmldom (bundled via mammoth's deps).
 * Parses .xlsx files with exceljs.
 * Writes results to the TiDB database via drizzle.
 *
 * This module is designed to run in the PRODUCTION environment where:
 *   - GOOGLE_WORKSPACE_CLI_TOKEN is injected by the Manus platform
 *   - DATABASE_URL is injected by the Manus platform
 *   - No rclone, Python, or external tools are available
 */

import { getDb } from "./db";
import {
  dashboardItems,
  decisions,
  milestones,
  softwareItems,
  systemsItems,
  hearingItems,
  aiItems,
  upcomingReviews,
  syncMetadata,
  pdpStatus,
} from "../drizzle/schema";

// ─── Google Drive API helpers ────────────────────────────────────────────────

const DRIVE_API = "https://www.googleapis.com/drive/v3";

function getToken(): string {
  const token = process.env.GOOGLE_WORKSPACE_CLI_TOKEN || process.env.GOOGLE_DRIVE_TOKEN || "";
  if (!token) throw new Error("GOOGLE_WORKSPACE_CLI_TOKEN is not set");
  return token;
}

async function driveRequest(path: string, params: Record<string, string> = {}): Promise<any> {
  const token = getToken();
  const url = new URL(`${DRIVE_API}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive API ${path} failed ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function driveDownload(fileId: string): Promise<ArrayBuffer> {
  const token = getToken();
  const url = `${DRIVE_API}/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive download ${fileId} failed ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.arrayBuffer();
}

/** List files in a folder, returns array of { id, name, modifiedTime } */
async function listFolder(folderId: string, namePattern?: RegExp): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
  let allFiles: any[] = [];
  let pageToken: string | undefined;
  do {
    const params: Record<string, string> = {
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,modifiedTime)",
      pageSize: "200",
      orderBy: "modifiedTime desc",
    };
    if (pageToken) params.pageToken = pageToken;
    const data = await driveRequest("/files", params);
    allFiles = allFiles.concat(data.files || []);
    pageToken = data.nextPageToken;
  } while (pageToken);

  if (namePattern) {
    allFiles = allFiles.filter((f) => namePattern.test(f.name));
  }
  return allFiles;
}

/** Find a file by exact name in a folder */
async function findFileByName(folderId: string, name: string): Promise<{ id: string; name: string; modifiedTime: string } | null> {
  const token = getToken();
  const url = new URL(`${DRIVE_API}/files`);
  url.searchParams.set("q", `'${folderId}' in parents and name = '${name.replace(/'/g, "\\'")}' and trashed = false`);
  url.searchParams.set("fields", "files(id,name,modifiedTime)");
  url.searchParams.set("pageSize", "5");
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.files?.[0] || null;
}

/** Search for a file by name across all of My Drive (shared-with-me included) */
async function searchFile(name: string): Promise<{ id: string; name: string; modifiedTime: string } | null> {
  const token = getToken();
  const url = new URL(`${DRIVE_API}/files`);
  url.searchParams.set("q", `name = '${name.replace(/'/g, "\\'")}' and trashed = false`);
  url.searchParams.set("fields", "files(id,name,modifiedTime)");
  url.searchParams.set("pageSize", "5");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  url.searchParams.set("supportsAllDrives", "true");
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.files?.[0] || null;
}

/** Search for files using a custom query across all drives */
async function driveSearch(query: string): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
  const token = getToken();
  const url = new URL(`${DRIVE_API}/files`);
  url.searchParams.set("q", query);
  url.searchParams.set("fields", "files(id,name,modifiedTime)");
  url.searchParams.set("pageSize", "20");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("orderBy", "modifiedTime desc");
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.files || [];
}

// ─── .docx XML parsing helpers ───────────────────────────────────────────────

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

interface ParsedRun {
  text: string;
  bold: boolean;
  blue: boolean; // blue-ish color = "new" information
  hyperlink?: string;
}

interface ParsedParagraph {
  text: string;       // plain text
  richText: string;   // markdown with **bold** and [link](url)
  isNew: boolean;     // any blue run
  indentLevel: number; // from numbering ilvl
  numLevel: number;   // raw ilvl value
  runs: ParsedRun[];
}

async function loadDocx(buffer: ArrayBuffer): Promise<{
  paragraphs: ParsedParagraph[];
  tables: Array<Array<Array<ParsedParagraph[]>>>;  // table[row][col] = paragraphs
  relationships: Record<string, string>;
}> {
  // Use JSZip (bundled via mammoth)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const JSZip = require("jszip");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DOMParser } = require("@xmldom/xmldom");

  const zip = await JSZip.loadAsync(buffer);
  
  // Load relationships
  const relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string") || "";
  const relationships: Record<string, string> = {};
  if (relsXml) {
    const relsDoc = new DOMParser().parseFromString(relsXml, "text/xml");
    const rels = relsDoc.getElementsByTagName("Relationship");
    for (let i = 0; i < rels.length; i++) {
      const rel = rels[i];
      const id = rel.getAttribute("Id") || "";
      const target = rel.getAttribute("Target") || "";
      const type = rel.getAttribute("Type") || "";
      if (type.includes("hyperlink")) {
        relationships[id] = target;
      }
    }
  }

  // Load numbering (for indent levels)
  const numberingXml = await zip.file("word/numbering.xml")?.async("string") || "";
  
  // Load main document
  const docXml = await zip.file("word/document.xml")?.async("string") || "";
  const doc = new DOMParser().parseFromString(docXml, "text/xml");

  function getAttr(el: any, ns: string, local: string): string {
    return el.getAttributeNS(ns, local) || el.getAttribute(`w:${local}`) || "";
  }

  function parseRunColor(rPr: any): boolean {
    if (!rPr) return false;
    // Check <w:color w:val="..."/>
    const colorEls = rPr.getElementsByTagNameNS(W_NS, "color");
    for (let i = 0; i < colorEls.length; i++) {
      const val = getAttr(colorEls[i], W_NS, "val");
      if (val && val !== "auto") {
        const r = parseInt(val.slice(0, 2), 16);
        const g = parseInt(val.slice(2, 4), 16);
        const b = parseInt(val.slice(4, 6), 16);
        if (b > 150 && b > r && b > g) return true;
      }
    }
    return false;
  }

  function parseRunBold(rPr: any): boolean {
    if (!rPr) return false;
    const bEls = rPr.getElementsByTagNameNS(W_NS, "b");
    for (let i = 0; i < bEls.length; i++) {
      const val = getAttr(bEls[i], W_NS, "val");
      if (val !== "0" && val !== "false") return true;
    }
    return false;
  }

  function getRunText(r: any): string {
    const tEls = r.getElementsByTagNameNS(W_NS, "t");
    let text = "";
    for (let i = 0; i < tEls.length; i++) {
      text += tEls[i].textContent || "";
    }
    return text;
  }

  function parseParagraph(pEl: any): ParsedParagraph {
    const runs: ParsedRun[] = [];
    let isNew = false;
    let indentLevel = 0;
    let numLevel = 0;

    // Get numbering level from pPr/numPr/ilvl
    const pPrEls = pEl.getElementsByTagNameNS(W_NS, "pPr");
    if (pPrEls.length > 0) {
      const numPrEls = pPrEls[0].getElementsByTagNameNS(W_NS, "numPr");
      if (numPrEls.length > 0) {
        const ilvlEls = numPrEls[0].getElementsByTagNameNS(W_NS, "ilvl");
        if (ilvlEls.length > 0) {
          numLevel = parseInt(getAttr(ilvlEls[0], W_NS, "val") || "0");
        }
      }
    }

    // Process children: hyperlinks and runs
    const children = pEl.childNodes;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const localName = child.localName || child.nodeName?.split(":").pop();

      if (localName === "hyperlink") {
        // Get hyperlink URL
        const rId = child.getAttributeNS(R_NS, "id") || child.getAttribute("r:id") || "";
        const url = relationships[rId] || "";
        
        // Get all runs inside hyperlink
        const innerRuns = child.getElementsByTagNameNS(W_NS, "r");
        let linkText = "";
        let linkBold = false;
        for (let j = 0; j < innerRuns.length; j++) {
          const rPr = innerRuns[j].getElementsByTagNameNS(W_NS, "rPr")[0];
          const text = getRunText(innerRuns[j]);
          if (text) {
            linkText += text;
            if (parseRunBold(rPr)) linkBold = true;
            if (parseRunColor(rPr)) isNew = true;
          }
        }
        if (linkText) {
          runs.push({ text: linkText, bold: linkBold, blue: false, hyperlink: url });
        }
      } else if (localName === "r") {
        const rPr = child.getElementsByTagNameNS(W_NS, "rPr")[0];
        const text = getRunText(child);
        if (text) {
          const bold = parseRunBold(rPr);
          const blue = parseRunColor(rPr);
          if (blue) isNew = true;
          runs.push({ text, bold, blue });
        }
      }
    }

    // Build plain text and rich text
    let plainText = "";
    let richText = "";
    for (const run of runs) {
      plainText += run.text;
      let part = run.text;
      if (run.bold) part = `**${part}**`;
      if (run.hyperlink) part = `[${part}](${run.hyperlink})`;
      richText += part;
    }

    // Map numLevel to indentLevel
    // Devices/Software: doc_level 0,1,2 -> indent 0; 3+ -> indent doc_level-2
    // Systems: doc_level 0,1 -> indent 0; 2+ -> indent doc_level-1
    if (numLevel >= 3) {
      indentLevel = numLevel - 2;
    }

    return { text: plainText.trim(), richText: richText.trim(), isNew, indentLevel, numLevel, runs };
  }

  // Parse all paragraphs and tables from body
  const body = doc.getElementsByTagNameNS(W_NS, "body")[0];
  const paragraphs: ParsedParagraph[] = [];
  const tables: Array<Array<Array<ParsedParagraph[]>>> = [];

  if (body) {
    const bodyChildren = body.childNodes;
    for (let i = 0; i < bodyChildren.length; i++) {
      const child = bodyChildren[i];
      const localName = child.localName || child.nodeName?.split(":").pop();
      if (localName === "p") {
        paragraphs.push(parseParagraph(child));
      } else if (localName === "tbl") {
        // Parse table
        const tableData: Array<Array<ParsedParagraph[]>> = [];
        const rows = child.getElementsByTagNameNS(W_NS, "tr");
        for (let r = 0; r < rows.length; r++) {
          const rowData: Array<ParsedParagraph[]> = [];
          const cells = rows[r].getElementsByTagNameNS(W_NS, "tc");
          for (let c = 0; c < cells.length; c++) {
            const cellParas: ParsedParagraph[] = [];
            const cellParagraphs = cells[c].getElementsByTagNameNS(W_NS, "p");
            for (let p = 0; p < cellParagraphs.length; p++) {
              cellParas.push(parseParagraph(cellParagraphs[p]));
            }
            rowData.push(cellParas);
          }
          tableData.push(rowData);
        }
        tables.push(tableData);
      }
    }
  }

  return { paragraphs, tables, relationships };
}

function cellText(cellParas: ParsedParagraph[]): string {
  return cellParas.map((p) => p.richText).filter(Boolean).join(" ").trim();
}

// ─── Exec Summary (Devices) parser ───────────────────────────────────────────

const PRODUCT_NAMES: Record<string, string> = {
  "AI Glasses": "ai_glasses",
  "Wrist": "wrist",
  "Wrist/New Devices": "wrist",
  "Wrist / New Devices": "wrist",
  "ARG/SSG": "arg_ssg",
  "ARG / SSG": "arg_ssg",
  "In-Market": "in_market",
  "In Market": "in_market",
};
const SECTION_NAMES: Record<string, string> = {
  Highlights: "highlights",
  Risks: "risks",
  "Risks/Opens": "risks",
  Upcoming: "upcoming",
};

function parseExecSummary(doc: Awaited<ReturnType<typeof loadDocx>>) {
  const items: Array<{
    product: string;
    section: string;
    content: string;
    isNew: number;
    isWearablesTag: number;
    indentLevel: number;
    order: number;
  }> = [];

  let currentProduct: string | null = null;
  let currentSection: string | null = null;
  let order = 0;

  for (const para of doc.paragraphs) {
    const text = para.text;
    if (!text) continue;

    // Detect product headings
    if (PRODUCT_NAMES[text]) {
      currentProduct = PRODUCT_NAMES[text];
      currentSection = null;
      continue;
    }

    // Detect section headings
    const sectionKey = Object.keys(SECTION_NAMES).find(
      (k) => text === k || text.startsWith(k)
    );
    if (sectionKey) {
      currentSection = SECTION_NAMES[sectionKey];
      continue;
    }

    if (!currentProduct || !currentSection) continue;

    // Detect [wearables-tag]
    let content = para.richText;
    const isWearablesTag = /\[wearables-tag\]/i.test(content) ? 1 : 0;
    if (isWearablesTag) content = content.replace(/\[wearables-tag\]/gi, "").trim();

    // Intelligent risk detection
    let effectiveSection = currentSection;
    if (currentSection === "highlights") {
      const lower = content.toLowerCase();
      const strongRisk = [
        "mrbd risks", "mrbd risk", "risks/opens",
        "not meeting criteria", "behind schedule", "at risk",
        "we are concerned", "still aiming", "punted if not",
      ].some((s) => lower.includes(s));
      const phraseRisk = [
        "but 5 days delayed", "but delayed", "declared, but",
        "kpis may not be", "p90 numbers are concerning",
        "will be punted", "not complete by",
      ].some((s) => lower.includes(s));
      const hasPositive = ["🎉", "✅", "🏆", "🥇", "🌟", "⭐"].some((e) => content.includes(e));
      if ((strongRisk || phraseRisk) && !hasPositive) effectiveSection = "risks";
    }

    items.push({
      product: currentProduct,
      section: effectiveSection,
      content,
      isNew: para.isNew ? 1 : 0,
      isWearablesTag,
      indentLevel: para.indentLevel,
      order: order++,
    });
  }

  return items;
}

// ─── Decisions parser ─────────────────────────────────────────────────────────

function parseWeekNumber(weekStr: string): [number, number] | null {
  if (!weekStr) return null;
  const s = weekStr.trim().toUpperCase();
  let weekPart: string, yearPart: string;
  if (s.includes(" ")) {
    const parts = s.split(/\s+/);
    weekPart = parts[0].replace(/^W+/, "");
    yearPart = parts[1] || String(new Date().getFullYear());
  } else {
    weekPart = s.replace(/^W+/, "");
    yearPart = String(new Date().getFullYear());
  }
  const week = parseInt(weekPart);
  const year = parseInt(yearPart);
  if (isNaN(week) || isNaN(year)) return null;
  return [week, year];
}

function isWithinLast20Weeks(weekStr: string): boolean {
  const parsed = parseWeekNumber(weekStr);
  if (!parsed) return false;
  const [week, year] = parsed;
  const now = new Date();
  const currentWeek = getISOWeek(now);
  const currentYear = now.getFullYear();
  let diff: number;
  if (year === currentYear) {
    diff = currentWeek - week;
  } else if (year === currentYear - 1) {
    diff = currentWeek + (52 - week);
  } else {
    return false;
  }
  return diff >= 0 && diff <= 20;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function parseDecisions(doc: Awaited<ReturnType<typeof loadDocx>>) {
  const items: Array<{
    dri: string;
    forum: string;
    status: string;
    week: string;
    decisionOutcome: string;
  }> = [];

  if (doc.tables.length === 0) return items;

  const table = doc.tables[0];
  for (let i = 1; i < table.length; i++) {
    const row = table[i];
    if (row.length < 5) continue;
    const cells = row.map((c) => cellText(c));
    if (cells[0] === "DRI" || cells[0] === "Decisions" || cells[0].includes("**DRI**")) continue;
    if (!cells[4] || cells[4].trim().length < 10) continue;
    const weekStr = cells[3];
    if (!isWithinLast20Weeks(weekStr)) continue;
    items.push({
      dri: cells[0],
      forum: cells[1],
      status: cells[2],
      week: weekStr,
      decisionOutcome: cells[4],
    });
  }

  // Sort by week descending
  items.sort((a, b) => {
    const pa = parseWeekNumber(a.week);
    const pb = parseWeekNumber(b.week);
    if (!pa || !pb) return 0;
    if (pa[1] !== pb[1]) return pb[1] - pa[1];
    return pb[0] - pa[0];
  });

  return items;
}

// ─── Software (I+E, AI, Hearing) parser ──────────────────────────────────────

type SoftwareCategory = "software_ie" | "software_ai" | "software_hearing";
type SoftwareSectionType = "wins" | "exec_summary" | "help_needed" | "decisions";

const SOFTWARE_SECTION_PATTERNS: Array<[RegExp, SoftwareSectionType]> = [
  [/^\s*(🏆|🥇|🎉)?\s*wins?\s*(\[async\])?\s*$/i, "wins"],
  [/(🚀|📣|^)\s*(exec\s+summary|fyis?)\s*(\[async\])?\s*$/i, "exec_summary"],
  [/(🆘|🚩)?\s*(help\s+needed|flag\s+(for\s+)?leadership)/i, "help_needed"],
];

function parseSoftwareDoc(
  doc: Awaited<ReturnType<typeof loadDocx>>,
  category: SoftwareCategory
): Array<{
  softwareCategory: SoftwareCategory;
  sectionType: SoftwareSectionType;
  content: string;
  isNew: number;
  isWearablesTag: number;
  indentLevel: number;
  order: number;
  dri?: string | null;
  forum?: string | null;
  status?: string | null;
  decisionDoc?: string | null;
  decisionMakers?: string | null;
  decisionOutcome?: string | null;
  post?: string | null;
}> {
  const items: Array<any> = [];
  let currentSection: SoftwareSectionType | null = null;
  let order = 0;

  for (const para of doc.paragraphs) {
    const text = para.text;
    if (!text) continue;

    // Detect section headings
    let matched = false;
    for (const [pattern, section] of SOFTWARE_SECTION_PATTERNS) {
      if (pattern.test(text)) {
        currentSection = section;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    if (!currentSection) continue;

    // Skip very short lines or all-caps lines (sub-headers)
    if (text.length < 10 || text === text.toUpperCase()) continue;

    let content = para.richText;
    const isWearablesTag = /\[wearables-tag\]/i.test(content) ? 1 : 0;
    if (isWearablesTag) content = content.replace(/\[wearables-tag\]/gi, "").trim();

    items.push({
      softwareCategory: category,
      sectionType: currentSection,
      content,
      isNew: para.isNew ? 1 : 0,
      isWearablesTag,
      indentLevel: para.indentLevel,
      order: order++,
    });
  }

  // Also extract decisions from tables
  for (const table of doc.tables) {
    if (table.length < 2) continue;
    const headers = table[0].map((c) => cellText(c).toLowerCase());
    const hasTopic = headers.some((h) => h.includes("topic"));
    const hasStatus = headers.some((h) => h.includes("status"));
    const hasOutcome = headers.some((h) => h.includes("outcome"));
    if (!hasTopic && !hasStatus && !hasOutcome) continue;

    const topicIdx = headers.findIndex((h) => h.includes("topic"));
    const driIdx = headers.findIndex((h) => h === "dri" || h.includes("dri"));
    const forumIdx = headers.findIndex((h) => h.includes("forum"));
    const statusIdx = headers.findIndex((h) => h.includes("status"));
    const docIdx = headers.findIndex((h) => h.includes("decision doc") || (h.includes("decision") && h.includes("doc")));
    const makersIdx = headers.findIndex((h) => h.includes("decision makers") || h.includes("reviewers") || h.includes("makers"));
    const outcomeIdx = headers.findIndex((h) => h.includes("decision outcome") || h.includes("outcome"));
    const postIdx = headers.findIndex((h) => h.includes("post"));

    for (let r = 1; r < table.length; r++) {
      const row = table[r];
      const topic = topicIdx >= 0 ? cellText(row[topicIdx] || []) : "";
      if (!topic) continue;
      items.push({
        softwareCategory: category,
        sectionType: "decisions" as SoftwareSectionType,
        content: topic,
        isNew: 0,
        isWearablesTag: 0,
        indentLevel: 0,
        order: order++,
        dri: driIdx >= 0 ? cellText(row[driIdx] || []) : null,
        forum: forumIdx >= 0 ? cellText(row[forumIdx] || []) : null,
        status: statusIdx >= 0 ? cellText(row[statusIdx] || []) : null,
        decisionDoc: docIdx >= 0 ? cellText(row[docIdx] || []) : null,
        decisionMakers: makersIdx >= 0 ? cellText(row[makersIdx] || []) : null,
        decisionOutcome: outcomeIdx >= 0 ? cellText(row[outcomeIdx] || []) : null,
        post: postIdx >= 0 ? cellText(row[postIdx] || []) : null,
      });
    }
  }

  return items;
}

// ─── Systems parser ───────────────────────────────────────────────────────────

type SystemsSectionType = "wins" | "exec_summary" | "help_needed";

const SYSTEMS_SECTION_PATTERNS: Array<[RegExp, SystemsSectionType]> = [
  [/^\s*(🏆|🥇|🎉)?\s*wins?\s*(\[async\])?\s*$/i, "wins"],
  [/(🚀|📣|^)\s*(exec\s+summary|fyis?)\s*(\[async\])?\s*$/i, "exec_summary"],
  [/(🆘|🚩)?\s*(help\s+needed|flag\s+(for\s+)?leadership)/i, "help_needed"],
];

function parseSystemsDoc(doc: Awaited<ReturnType<typeof loadDocx>>) {
  const items: Array<{
    sectionType: SystemsSectionType;
    content: string;
    isNew: number;
    isWearablesTag: number;
    indentLevel: number;
    order: number;
  }> = [];
  let currentSection: SystemsSectionType | null = null;
  let order = 0;

  for (const para of doc.paragraphs) {
    const text = para.text;
    if (!text) continue;

    let matched = false;
    for (const [pattern, section] of SYSTEMS_SECTION_PATTERNS) {
      if (pattern.test(text)) {
        currentSection = section;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (!currentSection) continue;
    if (text.length < 10 || text === text.toUpperCase()) continue;

    let content = para.richText;
    const isWearablesTag = /\[wearables-tag\]/i.test(content) ? 1 : 0;
    if (isWearablesTag) content = content.replace(/\[wearables-tag\]/gi, "").trim();

    // Systems uses slightly different indent mapping
    let indentLevel = 0;
    if (para.numLevel >= 2) indentLevel = para.numLevel - 1;

    items.push({
      sectionType: currentSection,
      content,
      isNew: para.isNew ? 1 : 0,
      isWearablesTag,
      indentLevel,
      order: order++,
    });
  }

  return items;
}

// ─── Milestones (XLSX) parser ─────────────────────────────────────────────────

function excelDateToISO(val: any): string | null {
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === "number") {
    const base = new Date(1899, 11, 30);
    base.setDate(base.getDate() + Math.floor(val));
    return base.toISOString().slice(0, 10);
  }
  if (typeof val === "string") {
    for (const fmt of [/^(\d{4})-(\d{2})-(\d{2})/, /^(\d{2})\/(\d{2})\/(\d{4})/]) {
      const m = val.match(fmt);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    }
  }
  return null;
}

type MilestoneType = "pdp_gates" | "sdp_milestones" | "sw_milestones" | "hw_dates" | "release_milestones" | "gtm_milestones";

function categorizeMilestone(typeStr: string | null | undefined): MilestoneType {
  if (!typeStr) return "sw_milestones";
  const lower = typeStr.toLowerCase();
  if (lower.includes("pdp") && lower.includes("milestone")) return "pdp_gates";
  if (lower.includes("sdp") && lower.includes("milestone")) return "sdp_milestones";
  if (lower.includes("gtm") || lower.includes("go-to-market") || lower.includes("go to market")) return "gtm_milestones";
  if (lower.includes("sw") || lower.includes("software")) return "sw_milestones";
  if (lower.includes("hw") || lower.includes("hardware") || lower.includes("build")) return "hw_dates";
  if (lower.includes("silicon")) return "hw_dates";
  if (lower.includes("launch") || lower.includes("release")) return "release_milestones";
  return "sw_milestones";
}

async function parseMilestonesXlsx(buffer: ArrayBuffer): Promise<Array<{
  product: string;
  milestoneName: string;
  milestoneDate: Date;
  milestoneType: MilestoneType;
  originalType: string | null;
}>> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ExcelJS = require("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer));

  const results: Array<any> = [];

  // Try Aggregation Sheet format first
  const releaseBeast = workbook.getWorksheet("Release_Beast_Data");
  const smartSheet = workbook.getWorksheet("Smart_Sheet_Data");

  if (releaseBeast) {
    const headers: string[] = [];
    releaseBeast.getRow(1).eachCell((cell: any, col: number) => {
      headers[col - 1] = String(cell.value || "").trim().toLowerCase();
    });
    const productIdx = headers.findIndex((h) => h === "product_label" || h === "product");
    const milestoneIdx = headers.findIndex((h) => h.includes("release_event"));
    const dateIdx = headers.findIndex((h) => h.includes("current_planned_date") || h.includes("initial_planned_date"));
    const typeIdx = headers.findIndex((h) => h.includes("milestone type"));

    if (productIdx >= 0 && milestoneIdx >= 0 && dateIdx >= 0) {
      releaseBeast.eachRow((row: any, rowNum: number) => {
        if (rowNum === 1) return;
        const product = String(row.getCell(productIdx + 1).value || "").trim();
        const milestoneName = String(row.getCell(milestoneIdx + 1).value || "").trim();
        const dateVal = row.getCell(dateIdx + 1).value;
        const typeVal = typeIdx >= 0 ? String(row.getCell(typeIdx + 1).value || "") : null;
        if (!product || !milestoneName || !dateVal) return;
        const dateStr = excelDateToISO(dateVal);
        if (!dateStr) return;
        results.push({
          product,
          milestoneName,
          milestoneDate: new Date(dateStr),
          milestoneType: categorizeMilestone(typeVal || milestoneName),
          originalType: typeVal,
        });
      });
    }
  }

  if (smartSheet) {
    const headers: string[] = [];
    smartSheet.getRow(1).eachCell((cell: any, col: number) => {
      headers[col - 1] = String(cell.value || "").trim().toLowerCase();
    });
    const productIdx = headers.findIndex((h) => h.includes("device_name"));
    const milestoneIdx = headers.findIndex((h) => h.includes("milestone_name"));
    const dateIdx = headers.findIndex((h) => h.includes("milestone_date"));

    if (productIdx >= 0 && milestoneIdx >= 0 && dateIdx >= 0) {
      smartSheet.eachRow((row: any, rowNum: number) => {
        if (rowNum === 1) return;
        const product = String(row.getCell(productIdx + 1).value || "").trim();
        const milestoneName = String(row.getCell(milestoneIdx + 1).value || "").trim();
        const dateVal = row.getCell(dateIdx + 1).value;
        if (!product || !milestoneName || !dateVal) return;
        const dateStr = excelDateToISO(dateVal);
        if (!dateStr) return;
        results.push({
          product,
          milestoneName,
          milestoneDate: new Date(dateStr),
          milestoneType: categorizeMilestone(milestoneName),
          originalType: null,
        });
      });
    }
  }

  // Fallback: SOT format (Consolidated View)
  if (results.length === 0) {
    const ws = workbook.worksheets[0];
    if (ws) {
      let headerRow = -1;
      const headers: string[] = [];
      ws.eachRow((row: any, rowNum: number) => {
        if (headerRow >= 0) return;
        const vals = row.values as any[];
        if (vals.some((v: any) => v && String(v).toLowerCase().includes("product"))) {
          headerRow = rowNum;
          vals.forEach((v: any, i: number) => { headers[i] = String(v || "").trim().toLowerCase(); });
        }
      });
      if (headerRow >= 0) {
        const productIdx = headers.findIndex((h) => h && h.includes("product"));
        const milestoneIdx = headers.findIndex((h) => h && h.includes("milestone"));
        const dateIdx = headers.findIndex((h) => h && h.includes("date"));
        const typeIdx = headers.findIndex((h) => h && h.includes("type"));
        ws.eachRow((row: any, rowNum: number) => {
          if (rowNum <= headerRow) return;
          const product = String(row.getCell(productIdx + 1).value || "").trim();
          const milestoneName = String(row.getCell(milestoneIdx + 1).value || "").trim();
          const dateVal = row.getCell(dateIdx + 1).value;
          const typeVal = typeIdx >= 0 ? String(row.getCell(typeIdx + 1).value || "") : null;
          if (!product || !milestoneName || !dateVal) return;
          const dateStr = excelDateToISO(dateVal);
          if (!dateStr) return;
          results.push({
            product,
            milestoneName,
            milestoneDate: new Date(dateStr),
            milestoneType: categorizeMilestone(typeVal),
            originalType: typeVal,
          });
        });
      }
    }
  }

  return results;
}

// ─── Upcoming Reviews (XLSX) parser ──────────────────────────────────────────

function getWeekString(date: Date): string {
  const week = getISOWeek(date);
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = date.getDate();
  return `W${week} (${month} ${day})`;
}

async function parseUpcomingReviewsXlsx(
  wearablesBuffer: ArrayBuffer,
  productBuffer: ArrayBuffer,
  systemsBuffer: ArrayBuffer
): Promise<Array<{
  reviewType: string;
  week: string;
  date: Date;
  topic: string;
  description: string | null;
  owner: string | null;
}>> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ExcelJS = require("exceljs");
  const now = new Date();
  const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const results: Array<any> = [];

  async function parseSheet(buffer: ArrayBuffer, sheetName: string, parseRow: (row: any, ws: any) => any) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer));
    const ws = wb.getWorksheet(sheetName);
    if (!ws) {
      console.warn(`[UpcomingReviews] Sheet '${sheetName}' not found`);
      return;
    }
    let currentDate: Date | null = null;
    let currentPillar: string | null = null;
    ws.eachRow((row: any, rowNum: number) => {
      if (rowNum <= 4) return; // Skip header rows
      const result = parseRow(row, ws);
      if (result === "skip") return;
      if (result?.date) currentDate = result.date;
      if (result?.pillar) currentPillar = result.pillar;
      if (result?.review && currentDate && currentDate >= now && currentDate <= twoWeeks) {
        results.push({ ...result.review, week: getWeekString(currentDate), date: currentDate });
      }
    });
  }

  // Wearables Reviews
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(wearablesBuffer));
    const ws = wb.getWorksheet("2026 Wearables Reviews");
    if (ws) {
      let currentDate: Date | null = null;
      let currentPillar: string | null = null;
      ws.eachRow((row: any, rowNum: number) => {
        if (rowNum <= 4) return;
        const dateCell = row.getCell(1).value;
        const pillar = row.getCell(2).value ? String(row.getCell(2).value) : null;
        const presenter = row.getCell(7).value ? String(row.getCell(7).value) : null;
        const title = row.getCell(11).value ? String(row.getCell(11).value) : null;
        const topicSummary = row.getCell(12).value ? String(row.getCell(12).value) : null;
        if (dateCell instanceof Date) currentDate = dateCell;
        if (pillar) currentPillar = pillar;
        const usePillar = pillar || currentPillar;
        if (!currentDate || currentDate < now || currentDate > twoWeeks) return;
        if (!usePillar && !presenter) return;
        if (!title && !topicSummary) return;
        results.push({
          reviewType: usePillar || "Wearables Review",
          week: getWeekString(currentDate),
          date: new Date(currentDate),
          topic: title || "TBD",
          description: topicSummary || title || null,
          owner: presenter || null,
        });
      });
    }
  } catch (e) {
    console.warn("[UpcomingReviews] Error parsing Wearables sheet:", e);
  }

  // Product Reviews
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(productBuffer));
    const ws = wb.getWorksheet("2026 Product Reviews");
    if (ws) {
      let currentDate: Date | null = null;
      ws.eachRow((row: any, rowNum: number) => {
        if (rowNum <= 4) return;
        const dateCell = row.getCell(1).value;
        const presenter = row.getCell(7).value ? String(row.getCell(7).value) : null;
        const title = row.getCell(11).value ? String(row.getCell(11).value) : null;
        const topicSummary = row.getCell(12).value ? String(row.getCell(12).value) : null;
        if (dateCell instanceof Date) currentDate = dateCell;
        if (!currentDate || currentDate < now || currentDate > twoWeeks) return;
        if (!title && !topicSummary) return;
        results.push({
          reviewType: "Product Review",
          week: getWeekString(currentDate),
          date: new Date(currentDate),
          topic: title || "TBD",
          description: topicSummary || title || null,
          owner: presenter || null,
        });
      });
    }
  } catch (e) {
    console.warn("[UpcomingReviews] Error parsing Product sheet:", e);
  }

  // Systems Reviews
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(systemsBuffer));
    const ws = wb.getWorksheet("2026 Systems Reviews");
    if (ws) {
      ws.eachRow((row: any, rowNum: number) => {
        if (rowNum <= 4) return;
        const requestedDate = row.getCell(1).value;
        const scheduledDate = row.getCell(3).value;
        const title = row.getCell(10).value ? String(row.getCell(10).value) : null;
        const topicSummary = row.getCell(11).value ? String(row.getCell(11).value) : null;
        const owner = row.getCell(9).value ? String(row.getCell(9).value) : null;
        const reviewDate = scheduledDate instanceof Date ? scheduledDate : requestedDate instanceof Date ? requestedDate : null;
        if (!reviewDate || reviewDate < now || reviewDate > twoWeeks) return;
        if (!title && !topicSummary) return;
        results.push({
          reviewType: "Systems Review",
          week: getWeekString(reviewDate),
          date: new Date(reviewDate),
          topic: title || "TBD",
          description: topicSummary || title || null,
          owner: owner || null,
        });
      });
    }
  } catch (e) {
    console.warn("[UpcomingReviews] Error parsing Systems sheet:", e);
  }

  results.sort((a, b) => a.date.getTime() - b.date.getTime());
  return results;
}

// ─── Google Drive folder IDs (from sync scripts and routers.ts) ───────────────

// These are the Google Drive folder IDs for the Wearables Everything shared drive.
// Files are found by searching by name within the root of the shared drive.
// The root folder ID is the "Wearables Everything" folder.
const WEARABLES_FOLDER_ID = "1JY78rUBZquuOd2kCVzTU6_t_ozM3DH7I"; // Wearables Everything folder
const SYSTEMS_ARCHIVE_FOLDER_ID = "1Qf4aS6k4QbCd_0DF2OCz7AMSUiKFvFWw"; // Systems Software Reviews folder

// ─── Main sync orchestrator ───────────────────────────────────────────────────

export interface ScheduledSyncResult {
  success: boolean;
  sources: Record<string, { success: boolean; items: number; error?: string }>;
  totalItems: number;
  durationMs: number;
  timestamp: string;
}

export async function runScheduledSync(): Promise<ScheduledSyncResult> {
  const start = Date.now();
  const sources: Record<string, { success: boolean; items: number; error?: string }> = {};

  console.log("[ScheduledSync] Starting Node.js-native sync...");

  const db = await getDb();
  if (!db) {
    throw new Error("Database not available — DATABASE_URL is not set");
  }

  // ── 1. Devices (Device Canonical Program Review.docx) ──────────────────────
  try {
    console.log("[ScheduledSync] Syncing Devices...");
    // Search for the canonical file by name
    const file = await searchFile("Device Canonical Program Review.docx");
    if (!file) throw new Error("Device Canonical Program Review.docx not found in Drive");
    const buf = await driveDownload(file.id);
    const doc = await loadDocx(buf);
    const items = parseExecSummary(doc);
    await db.delete(dashboardItems);
    if (items.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < items.length; i += BATCH) {
        await db.insert(dashboardItems).values(
          items.slice(i, i + BATCH).map((item) => ({
            sectionType: item.section as any,
            productCategory: item.product as any,
            content: item.content,
            isNew: item.isNew,
            isWearablesTag: item.isWearablesTag,
            indentLevel: item.indentLevel,
            order: item.order,
          }))
        );
      }
    }
    // Update sync metadata
    await upsertSyncMeta(db, "devices", file.id, file.name, file.modifiedTime,
      `https://docs.google.com/document/d/${file.id}/edit`);
    sources.devices = { success: true, items: items.length };
    console.log(`[ScheduledSync] Devices: ${items.length} items`);
  } catch (e: any) {
    console.error("[ScheduledSync] Devices failed:", e.message);
    sources.devices = { success: false, items: 0, error: e.message };
  }

  // ── 2. Decisions (Wearable Decisions Canonical .docx) ─────────────────────
  try {
    console.log("[ScheduledSync] Syncing Decisions...");
    const file = await searchFile("Wearable Decisions Canonical .docx");
    if (!file) throw new Error("Wearable Decisions Canonical .docx not found in Drive");
    const buf = await driveDownload(file.id);
    const doc = await loadDocx(buf);
    const items = parseDecisions(doc);
    await db.delete(decisions);
    if (items.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < items.length; i += BATCH) {
        await db.insert(decisions).values(
          items.slice(i, i + BATCH).map((item) => ({
            dri: item.dri,
            forum: item.forum,
            status: item.status,
            week: item.week,
            decisionOutcome: item.decisionOutcome,
          }))
        );
      }
    }
    sources.decisions = { success: true, items: items.length };
    console.log(`[ScheduledSync] Decisions: ${items.length} items`);
  } catch (e: any) {
    console.error("[ScheduledSync] Decisions failed:", e.message);
    sources.decisions = { success: false, items: 0, error: e.message };
  }

  // ── 3. Software — I+E (canonical doc) ─────────────────────────────────────
  try {
    console.log("[ScheduledSync] Syncing Software (I+E)...");
    const file = await searchFile("Software (I+E, AI, Hearing) Canonical Program Review.docx");
    if (!file) throw new Error("Software (I+E, AI, Hearing) Canonical Program Review.docx not found");
    const buf = await driveDownload(file.id);
    const doc = await loadDocx(buf);
    const items = parseSoftwareDoc(doc, "software_ie");
    await db.delete(softwareItems);
    if (items.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < items.length; i += BATCH) {
        await db.insert(softwareItems).values(
          items.slice(i, i + BATCH).map((item) => ({
            softwareCategory: item.softwareCategory,
            sectionType: item.sectionType,
            content: item.content,
            isNew: item.isNew,
            isWearablesTag: item.isWearablesTag,
            indentLevel: item.indentLevel,
            order: item.order,
            dri: item.dri || null,
            forum: item.forum || null,
            status: item.status || null,
            decisionDoc: item.decisionDoc || null,
            decisionMakers: item.decisionMakers || null,
            decisionOutcome: item.decisionOutcome || null,
            post: item.post || null,
          }))
        );
      }
    }
    await upsertSyncMeta(db, "software", file.id, file.name, file.modifiedTime,
      `https://docs.google.com/document/d/${file.id}/edit`);
    sources.software_ie = { success: true, items: items.length };
    console.log(`[ScheduledSync] Software I+E: ${items.length} items`);
  } catch (e: any) {
    console.error("[ScheduledSync] Software I+E failed:", e.message);
    sources.software_ie = { success: false, items: 0, error: e.message };
  }

  // ── 4. Systems (latest WK## archive) ──────────────────────────────────────
  try {
    console.log("[ScheduledSync] Syncing Systems...");
    // List archive folder and find latest WK## file
    const files = await listFolder(SYSTEMS_ARCHIVE_FOLDER_ID,
      /Wearables\s+Systems\s+Review[-\s]+WK?\d+[-\s]+\d{4}\.docx/i);
    if (files.length === 0) throw new Error("No Systems review files found in archive folder");
    // Sort by modifiedTime desc, pick latest
    files.sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime));
    const file = files[0];
    const buf = await driveDownload(file.id);
    const doc = await loadDocx(buf);
    const items = parseSystemsDoc(doc);
    await db.delete(systemsItems);
    if (items.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < items.length; i += BATCH) {
        await db.insert(systemsItems).values(
          items.slice(i, i + BATCH).map((item) => ({
            sectionType: item.sectionType as any,
            content: item.content,
            isNew: item.isNew,
            isWearablesTag: item.isWearablesTag,
            indentLevel: item.indentLevel,
            order: item.order,
          }))
        );
      }
    }
    await upsertSyncMeta(db, "systems", file.id, file.name, file.modifiedTime,
      `https://docs.google.com/document/d/${file.id}/edit`);
    sources.systems = { success: true, items: items.length };
    console.log(`[ScheduledSync] Systems: ${items.length} items`);
  } catch (e: any) {
    console.error("[ScheduledSync] Systems failed:", e.message);
    sources.systems = { success: false, items: 0, error: e.message };
  }

  // ── 5. Milestones (Aggregation Sheet or SOT xlsx) ─────────────────────────
  try {
    console.log("[ScheduledSync] Syncing Milestones...");
    let file = await searchFile("Wearables Device Program Milestones - Aggregation Sheet.xlsx");
    if (!file) {
      file = await searchFile("Wearable Program Milestones SOT - For AI ／ User Consumption.xlsx");
    }
    if (!file) throw new Error("Milestones spreadsheet not found in Drive");
    const buf = await driveDownload(file.id);
    const items = await parseMilestonesXlsx(buf);
    await db.delete(milestones);
    if (items.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < items.length; i += BATCH) {
        await db.insert(milestones).values(
          items.slice(i, i + BATCH).map((item) => ({
            product: item.product,
            milestoneName: item.milestoneName,
            milestoneDate: item.milestoneDate,
            milestoneType: item.milestoneType,
            originalType: item.originalType || "",
          }))
        );
      }
    }
    sources.milestones = { success: true, items: items.length };
    console.log(`[ScheduledSync] Milestones: ${items.length} items`);
  } catch (e: any) {
    console.error("[ScheduledSync] Milestones failed:", e.message);
    sources.milestones = { success: false, items: 0, error: e.message };
  }

  // ── 6. Upcoming Reviews (3 xlsx files) ────────────────────────────────────
  try {
    console.log("[ScheduledSync] Syncing Upcoming Reviews...");
    const [wFile, pFile, sFile] = await Promise.all([
      searchFile("2026 Wearables Reviews Sign-Up Sheet .xlsx"),
      searchFile("2026 Product Reviews Sign-Up Sheet.xlsx"),
      searchFile("Systems Reviews Sign-Up Sheet .xlsx"),
    ]);
    if (!wFile) throw new Error("2026 Wearables Reviews Sign-Up Sheet .xlsx not found");
    if (!pFile) throw new Error("2026 Product Reviews Sign-Up Sheet.xlsx not found");
    if (!sFile) throw new Error("Systems Reviews Sign-Up Sheet .xlsx not found");

    const [wBuf, pBuf, sBuf] = await Promise.all([
      driveDownload(wFile.id),
      driveDownload(pFile.id),
      driveDownload(sFile.id),
    ]);
    const items = await parseUpcomingReviewsXlsx(wBuf, pBuf, sBuf);
    await db.delete(upcomingReviews);
    if (items.length > 0) {
      await db.insert(upcomingReviews).values(
        items.map((item) => ({
          reviewType: item.reviewType,
          week: item.week,
          date: item.date,
          topic: item.topic,
          description: item.description,
          owner: item.owner,
        }))
      );
    }
    sources.upcomingReviews = { success: true, items: items.length };
    console.log(`[ScheduledSync] Upcoming Reviews: ${items.length} items`);
  } catch (e: any) {
    console.error("[ScheduledSync] Upcoming Reviews failed:", e.message);
    sources.upcomingReviews = { success: false, items: 0, error: e.message };
  }

  // ── 7. AI Review (weekly AI WXX Hotspots / Product Review.docx) ──────────────
  try {
    console.log("[ScheduledSync] Syncing AI Review...");
    // Search for AI WXX review files across all drives
    const aiSearchResults = await driveSearch(
      `(name contains 'AI W' or (name contains 'AI' and name contains 'Hotspots') or (name contains 'AI' and name contains 'Product Review')) and name contains '.docx' and trashed = false`
    ).catch(() => [] as any[]);
    const weekPattern = /W(?:K)?(\d+)/i;
    const aiFile = (aiSearchResults as any[])
      .filter((f: any) => weekPattern.test(f.name) && /\.docx$/i.test(f.name))
      .sort((a: any, b: any) => {
        const wa = parseInt((weekPattern.exec(a.name) || ["0", "0"])[1]);
        const wb = parseInt((weekPattern.exec(b.name) || ["0", "0"])[1]);
        return wb - wa;
      })[0];
    if (!aiFile) throw new Error("No AI WXX review file found in Drive");
    console.log(`[ScheduledSync] AI Review: using ${aiFile.name}`);
    const buf = await driveDownload(aiFile.id);
    const doc = await loadDocx(buf);
    const items = parseSoftwareDoc(doc, "software_ai" as any);
    await db.delete(aiItems);
    if (items.length > 0) {
      await db.insert(aiItems).values(
        items.map((item) => ({
          sectionType: item.sectionType as "wins" | "exec_summary" | "decisions",
          content: item.content,
          isNew: item.isNew,
          isWearablesTag: item.isWearablesTag,
          indentLevel: item.indentLevel,
          order: item.order,
          dri: item.dri ?? null,
          forum: item.forum ?? null,
          status: item.status ?? null,
          decisionDoc: item.decisionDoc ?? null,
          decisionMakers: item.decisionMakers ?? null,
          post: item.post ?? null,
        }))
      );
    }
    sources.ai = { success: true, items: items.length };
    console.log(`[ScheduledSync] AI Review: ${items.length} items`);
  } catch (e: any) {
    console.error("[ScheduledSync] AI Review failed:", e.message);
    sources.ai = { success: false, items: 0, error: e.message };
  }

  // ── 8. Hearing/Health Review (weekly WXX Health Canonical Program Review.docx) ──
  try {
    console.log("[ScheduledSync] Syncing Hearing/Health Review...");
    const hearingSearchResults = await driveSearch(
      `name contains 'Health' and (name contains 'Program Review' or name contains 'Canonical') and name contains '.docx' and trashed = false`
    ).catch(() => [] as any[]);
    const hearingFile = (hearingSearchResults as any[])
      .filter((f: any) => /W(?:K)?\d+/i.test(f.name) && /\.docx$/i.test(f.name))
      .sort((a: any, b: any) => {
        const weekPattern = /W(?:K)?(\d+)/i;
        const wa = parseInt((weekPattern.exec(a.name) || ["0", "0"])[1]);
        const wb = parseInt((weekPattern.exec(b.name) || ["0", "0"])[1]);
        return wb - wa;
      })[0];
    if (!hearingFile) throw new Error("No WXX Health Canonical Program Review.docx found in Drive");
    console.log(`[ScheduledSync] Hearing Review: using ${hearingFile.name}`);
    const buf = await driveDownload(hearingFile.id);
    const doc = await loadDocx(buf);
    const items = parseSoftwareDoc(doc, "software_hearing" as any);
    await db.delete(hearingItems);
    if (items.length > 0) {
      await db.insert(hearingItems).values(
        items.map((item) => ({
          sectionType: item.sectionType as "wins" | "exec_summary" | "decisions",
          content: item.content,
          isNew: item.isNew,
          isWearablesTag: item.isWearablesTag,
          indentLevel: item.indentLevel,
          order: item.order,
          dri: item.dri ?? null,
          forum: item.forum ?? null,
          status: item.status ?? null,
          decisionDoc: item.decisionDoc ?? null,
          decisionMakers: item.decisionMakers ?? null,
        }))
      );
    }
    sources.hearing = { success: true, items: items.length };
    console.log(`[ScheduledSync] Hearing Review: ${items.length} items`);
  } catch (e: any) {
    console.error("[ScheduledSync] Hearing Review failed:", e.message);
    sources.hearing = { success: false, items: 0, error: e.message };
  }

  const totalItems = Object.values(sources).reduce((sum, s) => sum + s.items, 0);
  const allSuccess = Object.values(sources).every((s) => s.success);
  const durationMs = Date.now() - start;

  console.log(
    `[ScheduledSync] Complete: ${totalItems} items in ${(durationMs / 1000).toFixed(1)}s — ` +
    `${allSuccess ? "all sources OK" : "some sources failed"}`
  );

  return {
    success: allSuccess,
    sources,
    totalItems,
    durationMs,
    timestamp: new Date().toISOString(),
  };
}

// ─── Sync metadata helper ─────────────────────────────────────────────────────

async function upsertSyncMeta(
  db: any,
  section: string,
  fileId: string,
  fileName: string,
  modifiedTime: string,
  fileUrl: string
) {
  try {
    const existing = await (db.query as any).syncMetadata.findFirst({
      where: (sm: any, { eq }: any) => eq(sm.section, section),
    });
    const now = new Date();
    if (existing) {
      await db.update(syncMetadata)
        .set({
          documentId: fileId,
          sourceUrl: fileUrl,
          sourceFilePath: fileName,
          sourceFileName: fileName,
          sourceFileUrl: fileUrl,
          fileModifiedAt: new Date(modifiedTime),
          lastSyncedAt: now,
          syncStatus: "success",
          errorMessage: null,
        })
        .where((sm: any) => sm.id === existing.id);
    } else {
      await db.insert(syncMetadata).values({
        section,
        documentId: fileId,
        sourceUrl: fileUrl,
        sourceFilePath: fileName,
        sourceFileName: fileName,
        sourceFileUrl: fileUrl,
        fileModifiedAt: new Date(modifiedTime),
        lastSyncedAt: now,
        syncStatus: "success",
      });
    }
  } catch (e) {
    console.warn(`[ScheduledSync] Could not update sync metadata for ${section}:`, e);
  }
}
