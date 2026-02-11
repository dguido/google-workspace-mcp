import { unzipSync, strFromU8 } from "fflate";

const MAX_DECOMPRESSED_ENTRY_SIZE = 100 * 1024 * 1024;

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&apos;": "'",
  "&quot;": '"',
};

/**
 * Decode XML character entities to their literal equivalents.
 * Handles named entities and numeric references (decimal/hex).
 */
function decodeXmlEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|apos|quot|#(\d+)|#x([0-9a-fA-F]+));/g, (match, dec, hex) => {
    if (dec) return String.fromCodePoint(Number(dec));
    if (hex) {
      return String.fromCodePoint(parseInt(hex, 16));
    }
    return ENTITY_MAP[match] ?? match;
  });
}

/**
 * Extract readable text from a .docx file.
 * Parses word/document.xml for <w:p> paragraphs
 * containing <w:t> text runs.
 * Stops early when output exceeds maxChars.
 */
export function extractDocxText(data: Uint8Array, maxChars?: number): string {
  const files = unzipSync(data, {
    filter: (f) => f.name === "word/document.xml" && f.originalSize < MAX_DECOMPRESSED_ENTRY_SIZE,
  });
  const docEntry = files["word/document.xml"];
  if (!docEntry) {
    throw new Error("Invalid .docx: missing word/document.xml");
  }
  const xml = strFromU8(docEntry);
  const paragraphs: string[] = [];
  let charCount = 0;
  const pRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pXml = pMatch[0];
    const texts: string[] = [];
    let tMatch: RegExpExecArray | null;
    tRegex.lastIndex = 0;
    while ((tMatch = tRegex.exec(pXml)) !== null) {
      texts.push(tMatch[1]);
    }
    if (texts.length > 0) {
      const line = decodeXmlEntities(texts.join(""));
      paragraphs.push(line);
      charCount += line.length + 1; // +1 for newline
      if (maxChars !== undefined && charCount >= maxChars) {
        break;
      }
    }
  }
  return paragraphs.join("\n");
}

/**
 * Parse shared strings from sharedStrings.xml content.
 * Each <si> element may contain plain <t> or rich-text
 * <r><t> runs that are concatenated into a single value.
 */
function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siRegex = /<si>([\s\S]*?)<\/si>/g;
  const tRegex = /<t(?:\s[^>]*)?>([^<]*)<\/t>/g;
  let siMatch: RegExpExecArray | null;
  while ((siMatch = siRegex.exec(xml)) !== null) {
    const siContent = siMatch[1];
    const parts: string[] = [];
    let tMatch: RegExpExecArray | null;
    tRegex.lastIndex = 0;
    while ((tMatch = tRegex.exec(siContent)) !== null) {
      parts.push(tMatch[1]);
    }
    strings.push(decodeXmlEntities(parts.join("")));
  }
  return strings;
}

/**
 * Parse sheet names from workbook.xml content.
 * Returns names in document order as they appear
 * in the <sheets> element.
 */
function parseSheetNames(xml: string): string[] {
  const names: string[] = [];
  const sheetRegex = /<sheet\s[^>]*name="([^"]*)"[^>]*\/?>/g;
  let sMatch: RegExpExecArray | null;
  while ((sMatch = sheetRegex.exec(xml)) !== null) {
    names.push(decodeXmlEntities(sMatch[1]));
  }
  return names;
}

/**
 * Parse a cell reference like "C5" into a 0-based column index.
 */
function columnIndex(cellRef: string): number {
  const letters = cellRef.replace(/[0-9]/g, "");
  let idx = 0;
  for (let i = 0; i < letters.length; i++) {
    idx = idx * 26 + (letters.charCodeAt(i) - 64); // A=1
  }
  return idx - 1; // 0-based
}

/**
 * Extract readable text from a .xlsx file.
 * Parses shared strings, sheet names, and worksheet
 * cells into tab-separated rows per sheet.
 * Stops early when output exceeds maxChars.
 */
export function extractXlsxText(data: Uint8Array, maxChars?: number): string {
  const files = unzipSync(data, {
    filter: (f) =>
      f.originalSize < MAX_DECOMPRESSED_ENTRY_SIZE &&
      (f.name === "xl/sharedStrings.xml" ||
        f.name === "xl/workbook.xml" ||
        /^xl\/worksheets\/sheet\d+\.xml$/.test(f.name)),
  });
  const ssEntry = files["xl/sharedStrings.xml"];
  const sharedStrings = ssEntry ? parseSharedStrings(strFromU8(ssEntry)) : [];

  const wbEntry = files["xl/workbook.xml"];
  const sheetNames = wbEntry ? parseSheetNames(strFromU8(wbEntry)) : [];

  const wsNames = Object.keys(files)
    .filter((n) => n.startsWith("xl/worksheets/sheet"))
    .sort((a, b) => {
      const numA = parseInt(a.match(/sheet(\d+)/)?.[1] || "0", 10);
      const numB = parseInt(b.match(/sheet(\d+)/)?.[1] || "0", 10);
      return numA - numB;
    });

  const output: string[] = [];
  let charCount = 0;
  let budgetExceeded = false;
  for (let si = 0; si < wsNames.length; si++) {
    if (budgetExceeded) break;
    const sheetName = sheetNames[si] || `Sheet${si + 1}`;
    const header = `--- Sheet: ${sheetName} ---`;
    output.push(header);
    charCount += header.length + 1;
    const wsXml = strFromU8(files[wsNames[si]]);
    const rowRegex = /<row[\s>][\s\S]*?<\/row>/g;
    const cellRegex = /<c\s([^>]*)>[\s\S]*?<\/c>|<c\s([^>]*?)\/>/g;
    const valRegex = /<v>([^<]*)<\/v>/;
    const isRegex = /<is>[\s\S]*?<\/is>/;
    const tInIsRegex = /<t(?:\s[^>]*)?>([^<]*)<\/t>/g;

    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRegex.exec(wsXml)) !== null) {
      const rowXml = rowMatch[0];
      const cells: Array<{ col: number; value: string }> = [];
      cellRegex.lastIndex = 0;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
        const attrs = cellMatch[1] || cellMatch[2] || "";
        const rMatch = attrs.match(/r="([^"]*)"/);
        if (!rMatch) continue;
        const col = columnIndex(rMatch[1]);
        if (col < 0 || col > 20_000) continue;

        const tMatch = attrs.match(/t="([^"]*)"/);
        const cellType = tMatch?.[1] || "";
        let value = "";

        if (cellType === "s") {
          const vMatch = cellMatch[0].match(valRegex);
          if (vMatch) {
            const idx = parseInt(vMatch[1], 10);
            value = sharedStrings[idx] ?? "";
          }
        } else if (cellType === "inlineStr") {
          const isMatch = cellMatch[0].match(isRegex);
          if (isMatch) {
            const parts: string[] = [];
            let tM: RegExpExecArray | null;
            tInIsRegex.lastIndex = 0;
            while ((tM = tInIsRegex.exec(isMatch[0])) !== null) {
              parts.push(tM[1]);
            }
            value = decodeXmlEntities(parts.join(""));
          }
        } else {
          const vMatch = cellMatch[0].match(valRegex);
          if (vMatch) {
            value = decodeXmlEntities(vMatch[1]);
          }
        }

        cells.push({ col, value });
      }

      if (cells.length > 0) {
        const row: string[] = [];
        for (const cell of cells) {
          while (row.length < cell.col) {
            row.push("");
          }
          row[cell.col] = cell.value;
        }
        const line = row.join("\t");
        output.push(line);
        charCount += line.length + 1;
        if (maxChars !== undefined && charCount >= maxChars) {
          budgetExceeded = true;
          break;
        }
      }
    }
  }
  return output.join("\n");
}

/**
 * Extract readable text from a .pptx file.
 * Parses ppt/slides/slideN.xml for <a:p> paragraphs
 * containing <a:t> text runs.
 * Stops early when output exceeds maxChars.
 */
export function extractPptxText(data: Uint8Array, maxChars?: number): string {
  const files = unzipSync(data, {
    filter: (f) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(f.name) && f.originalSize < MAX_DECOMPRESSED_ENTRY_SIZE,
  });

  const slideNames = Object.keys(files).sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0", 10);
    const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0", 10);
    return numA - numB;
  });

  const output: string[] = [];
  let charCount = 0;
  for (let i = 0; i < slideNames.length; i++) {
    const header = `--- Slide ${i + 1} ---`;
    output.push(header);
    charCount += header.length + 1;
    const xml = strFromU8(files[slideNames[i]]);

    const paragraphs: string[] = [];
    const pRegex = /<a:p[\s>][\s\S]*?<\/a:p>/g;
    const tRegex = /<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = pRegex.exec(xml)) !== null) {
      const pXml = pMatch[0];
      const texts: string[] = [];
      let tMatch: RegExpExecArray | null;
      tRegex.lastIndex = 0;
      while ((tMatch = tRegex.exec(pXml)) !== null) {
        texts.push(tMatch[1]);
      }
      if (texts.length > 0) {
        paragraphs.push(decodeXmlEntities(texts.join("")));
      }
    }
    if (paragraphs.length > 0) {
      const slideText = paragraphs.join("\n");
      output.push(slideText);
      charCount += slideText.length + 1;
    }
    if (maxChars !== undefined && charCount >= maxChars) {
      break;
    }
  }

  return output.join("\n");
}
