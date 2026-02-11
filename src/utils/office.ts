import { unzipSync, strFromU8 } from "fflate";

/**
 * Decode XML character entities to their literal equivalents.
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

/**
 * Extract readable text from a .docx file.
 * Parses word/document.xml for <w:p> paragraphs
 * containing <w:t> text runs.
 */
export function extractDocxText(data: Uint8Array): string {
  const files = unzipSync(data, {
    filter: (f) => f.name === "word/document.xml",
  });
  const docEntry = files["word/document.xml"];
  if (!docEntry) {
    throw new Error("Invalid .docx: missing word/document.xml");
  }
  const xml = strFromU8(docEntry);
  const paragraphs: string[] = [];
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
      paragraphs.push(decodeXmlEntities(texts.join("")));
    }
  }
  return paragraphs.join("\n");
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
 */
export function extractXlsxText(data: Uint8Array): string {
  const files = unzipSync(data, {
    filter: (f) =>
      f.name === "xl/sharedStrings.xml" ||
      f.name === "xl/workbook.xml" ||
      f.name.startsWith("xl/worksheets/sheet"),
  });

  // Parse shared strings
  const sharedStrings: string[] = [];
  const ssEntry = files["xl/sharedStrings.xml"];
  if (ssEntry) {
    const ssXml = strFromU8(ssEntry);
    const siRegex = /<si>([\s\S]*?)<\/si>/g;
    const tRegex = /<t(?:\s[^>]*)?>([^<]*)<\/t>/g;
    let siMatch: RegExpExecArray | null;
    while ((siMatch = siRegex.exec(ssXml)) !== null) {
      const siContent = siMatch[1];
      const parts: string[] = [];
      let tMatch: RegExpExecArray | null;
      tRegex.lastIndex = 0;
      while ((tMatch = tRegex.exec(siContent)) !== null) {
        parts.push(tMatch[1]);
      }
      sharedStrings.push(decodeXmlEntities(parts.join("")));
    }
  }

  // Parse sheet names from workbook.xml
  const sheetNames: string[] = [];
  const wbEntry = files["xl/workbook.xml"];
  if (wbEntry) {
    const wbXml = strFromU8(wbEntry);
    const sheetRegex = /<sheet\s[^>]*name="([^"]*)"[^>]*\/?>/g;
    let sMatch: RegExpExecArray | null;
    while ((sMatch = sheetRegex.exec(wbXml)) !== null) {
      sheetNames.push(decodeXmlEntities(sMatch[1]));
    }
  }

  // Collect and sort worksheet filenames
  const wsNames = Object.keys(files)
    .filter((n) => n.startsWith("xl/worksheets/sheet"))
    .sort((a, b) => {
      const numA = parseInt(a.match(/sheet(\d+)/)?.[1] || "0", 10);
      const numB = parseInt(b.match(/sheet(\d+)/)?.[1] || "0", 10);
      return numA - numB;
    });

  const output: string[] = [];
  for (let si = 0; si < wsNames.length; si++) {
    const sheetName = sheetNames[si] || `Sheet${si + 1}`;
    output.push(`--- Sheet: ${sheetName} ---`);

    const wsXml = strFromU8(files[wsNames[si]]);
    const rows: string[][] = [];
    let maxCol = 0;

    const rowRegex = /<row[\s>][\s\S]*?<\/row>/g;
    const cellRegex = /<c\s([^>]*)>[\s\S]*?<\/c>|<c\s([^>]*?)\/>/g;
    const valRegex = /<v>([^<]*)<\/v>/;
    const isRegex = /<is>[\s\S]*?<\/is>/;
    const tInIsRegex = /<t(?:\s[^>]*)?>([^<]*)<\/t>/g;

    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRegex.exec(wsXml)) !== null) {
      const rowXml = rowMatch[0];
      const cells: Array<{
        col: number;
        value: string;
      }> = [];

      cellRegex.lastIndex = 0;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
        const attrs = cellMatch[1] || cellMatch[2] || "";
        const rMatch = attrs.match(/r="([^"]*)"/);
        if (!rMatch) continue;
        const col = columnIndex(rMatch[1]);
        if (col + 1 > maxCol) maxCol = col + 1;

        const tMatch = attrs.match(/t="([^"]*)"/);
        const cellType = tMatch?.[1] || "";
        let value = "";

        if (cellType === "s") {
          // Shared string reference
          const vMatch = cellMatch[0].match(valRegex);
          if (vMatch) {
            const idx = parseInt(vMatch[1], 10);
            value = sharedStrings[idx] ?? "";
          }
        } else if (cellType === "inlineStr") {
          // Inline string
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
          // Numeric or other literal
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
        rows.push(row);
      }
    }

    // Normalize row widths and format as TSV
    for (const row of rows) {
      while (row.length < maxCol) row.push("");
      output.push(row.join("\t"));
    }
  }

  return output.join("\n");
}

/**
 * Extract readable text from a .pptx file.
 * Parses ppt/slides/slideN.xml for <a:p> paragraphs
 * containing <a:t> text runs.
 */
export function extractPptxText(data: Uint8Array): string {
  const files = unzipSync(data, {
    filter: (f) => /^ppt\/slides\/slide\d+\.xml$/.test(f.name),
  });

  const slideNames = Object.keys(files).sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0", 10);
    const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0", 10);
    return numA - numB;
  });

  const output: string[] = [];
  for (let i = 0; i < slideNames.length; i++) {
    output.push(`--- Slide ${i + 1} ---`);
    const xml = strFromU8(files[slideNames[i]]);

    const paragraphs: string[] = [];
    const pRegex = /<a:p[\s>][\s\S]*?<\/a:p>/g;
    const tRegex = /<a:t>([^<]*)<\/a:t>/g;
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
      output.push(paragraphs.join("\n"));
    }
  }

  return output.join("\n");
}
