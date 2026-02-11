import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { extractDocxText, extractXlsxText, extractPptxText } from "./office.js";

function makeZip(entries: Record<string, string>): Uint8Array {
  const data: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(entries)) {
    data[name] = strToU8(content);
  }
  return zipSync(data);
}

describe("extractDocxText", () => {
  it("extracts single paragraph", () => {
    const xml = [
      '<?xml version="1.0"?>',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      "<w:body>",
      "<w:p><w:r><w:t>Hello World</w:t></w:r></w:p>",
      "</w:body>",
      "</w:document>",
    ].join("");
    const zip = makeZip({ "word/document.xml": xml });
    expect(extractDocxText(zip)).toBe("Hello World");
  });

  it("extracts multiple paragraphs", () => {
    const xml = [
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      "<w:body>",
      "<w:p><w:r><w:t>Line 1</w:t></w:r></w:p>",
      "<w:p><w:r><w:t>Line 2</w:t></w:r></w:p>",
      "<w:p><w:r><w:t>Line 3</w:t></w:r></w:p>",
      "</w:body>",
      "</w:document>",
    ].join("");
    const zip = makeZip({ "word/document.xml": xml });
    expect(extractDocxText(zip)).toBe("Line 1\nLine 2\nLine 3");
  });

  it("decodes XML entities", () => {
    const xml = [
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      "<w:body>",
      "<w:p><w:r><w:t>A &amp; B &lt; C &gt; D &apos;E&apos; &quot;F&quot;</w:t></w:r></w:p>",
      "</w:body>",
      "</w:document>",
    ].join("");
    const zip = makeZip({ "word/document.xml": xml });
    expect(extractDocxText(zip)).toBe("A & B < C > D 'E' \"F\"");
  });

  it("handles empty document", () => {
    const xml = [
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      "<w:body></w:body>",
      "</w:document>",
    ].join("");
    const zip = makeZip({ "word/document.xml": xml });
    expect(extractDocxText(zip)).toBe("");
  });

  it("joins multiple runs within a paragraph", () => {
    const xml = [
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      "<w:body>",
      "<w:p>",
      "<w:r><w:t>Hello </w:t></w:r>",
      "<w:r><w:t>World</w:t></w:r>",
      "</w:p>",
      "</w:body>",
      "</w:document>",
    ].join("");
    const zip = makeZip({ "word/document.xml": xml });
    expect(extractDocxText(zip)).toBe("Hello World");
  });

  it("throws on missing document.xml", () => {
    const zip = makeZip({ "word/other.xml": "<root/>" });
    expect(() => extractDocxText(zip)).toThrow("missing word/document.xml");
  });

  it("handles w:t with xml:space attribute", () => {
    const xml = [
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      "<w:body>",
      '<w:p><w:r><w:t xml:space="preserve"> spaced </w:t></w:r></w:p>',
      "</w:body>",
      "</w:document>",
    ].join("");
    const zip = makeZip({ "word/document.xml": xml });
    expect(extractDocxText(zip)).toBe(" spaced ");
  });
});

describe("extractXlsxText", () => {
  const sharedStrings = [
    '<?xml version="1.0"?>',
    '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    "<si><t>Name</t></si>",
    "<si><t>Age</t></si>",
    "<si><t>Alice</t></si>",
    "<si><t>Bob</t></si>",
    "</sst>",
  ].join("");

  const workbook = [
    '<?xml version="1.0"?>',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    "<sheets>",
    '<sheet name="People" sheetId="1" r:id="rId1"/>',
    "</sheets>",
    "</workbook>",
  ].join("");

  it("extracts shared string cells", () => {
    const sheet = [
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      "<sheetData>",
      "<row>",
      '<c r="A1" t="s"><v>0</v></c>',
      '<c r="B1" t="s"><v>1</v></c>',
      "</row>",
      "<row>",
      '<c r="A2" t="s"><v>2</v></c>',
      '<c r="B2" t="s"><v>3</v></c>',
      "</row>",
      "</sheetData>",
      "</worksheet>",
    ].join("");
    const zip = makeZip({
      "xl/sharedStrings.xml": sharedStrings,
      "xl/workbook.xml": workbook,
      "xl/worksheets/sheet1.xml": sheet,
    });
    const result = extractXlsxText(zip);
    expect(result).toContain("--- Sheet: People ---");
    expect(result).toContain("Name\tAge");
    expect(result).toContain("Alice\tBob");
  });

  it("extracts numeric cells", () => {
    const sheet = [
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      "<sheetData>",
      "<row>",
      '<c r="A1"><v>42</v></c>',
      '<c r="B1"><v>3.14</v></c>',
      "</row>",
      "</sheetData>",
      "</worksheet>",
    ].join("");
    const zip = makeZip({
      "xl/workbook.xml": workbook,
      "xl/worksheets/sheet1.xml": sheet,
    });
    const result = extractXlsxText(zip);
    expect(result).toContain("42\t3.14");
  });

  it("handles inline strings", () => {
    const sheet = [
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      "<sheetData>",
      "<row>",
      '<c r="A1" t="inlineStr"><is><t>Inline</t></is></c>',
      "</row>",
      "</sheetData>",
      "</worksheet>",
    ].join("");
    const zip = makeZip({
      "xl/workbook.xml": workbook,
      "xl/worksheets/sheet1.xml": sheet,
    });
    expect(extractXlsxText(zip)).toContain("Inline");
  });

  it("handles sparse columns", () => {
    const sheet = [
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      "<sheetData>",
      "<row>",
      '<c r="A1" t="s"><v>0</v></c>',
      '<c r="C1" t="s"><v>1</v></c>',
      "</row>",
      "</sheetData>",
      "</worksheet>",
    ].join("");
    const zip = makeZip({
      "xl/sharedStrings.xml": sharedStrings,
      "xl/workbook.xml": workbook,
      "xl/worksheets/sheet1.xml": sheet,
    });
    const result = extractXlsxText(zip);
    expect(result).toContain("Name\t\tAge");
  });

  it("handles multiple sheets", () => {
    const wb = [
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      "<sheets>",
      '<sheet name="First" sheetId="1" r:id="rId1"/>',
      '<sheet name="Second" sheetId="2" r:id="rId2"/>',
      "</sheets>",
      "</workbook>",
    ].join("");
    const sheet1 = [
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      "<sheetData>",
      '<row><c r="A1"><v>1</v></c></row>',
      "</sheetData>",
      "</worksheet>",
    ].join("");
    const sheet2 = [
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      "<sheetData>",
      '<row><c r="A1"><v>2</v></c></row>',
      "</sheetData>",
      "</worksheet>",
    ].join("");
    const zip = makeZip({
      "xl/workbook.xml": wb,
      "xl/worksheets/sheet1.xml": sheet1,
      "xl/worksheets/sheet2.xml": sheet2,
    });
    const result = extractXlsxText(zip);
    expect(result).toContain("--- Sheet: First ---");
    expect(result).toContain("--- Sheet: Second ---");
  });

  it("handles missing sharedStrings.xml", () => {
    const sheet = [
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      "<sheetData>",
      '<row><c r="A1"><v>99</v></c></row>',
      "</sheetData>",
      "</worksheet>",
    ].join("");
    const zip = makeZip({
      "xl/workbook.xml": workbook,
      "xl/worksheets/sheet1.xml": sheet,
    });
    const result = extractXlsxText(zip);
    expect(result).toContain("99");
  });

  it("handles rich text runs in shared strings", () => {
    const ss = [
      '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      "<si><r><t>Bold</t></r><r><t> Normal</t></r></si>",
      "</sst>",
    ].join("");
    const sheet = [
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      "<sheetData>",
      '<row><c r="A1" t="s"><v>0</v></c></row>',
      "</sheetData>",
      "</worksheet>",
    ].join("");
    const zip = makeZip({
      "xl/sharedStrings.xml": ss,
      "xl/workbook.xml": workbook,
      "xl/worksheets/sheet1.xml": sheet,
    });
    expect(extractXlsxText(zip)).toContain("Bold Normal");
  });
});

describe("extractPptxText", () => {
  it("extracts single slide", () => {
    const slide = [
      '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
      ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
      "<p:cSld>",
      "<p:spTree>",
      "<p:sp><p:txBody>",
      "<a:p><a:r><a:t>Hello Slide</a:t></a:r></a:p>",
      "</p:txBody></p:sp>",
      "</p:spTree>",
      "</p:cSld>",
      "</p:sld>",
    ].join("");
    const zip = makeZip({ "ppt/slides/slide1.xml": slide });
    const result = extractPptxText(zip);
    expect(result).toContain("--- Slide 1 ---");
    expect(result).toContain("Hello Slide");
  });

  it("extracts multiple slides in order", () => {
    const makeSlide = (text: string) =>
      [
        '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
        ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
        "<p:cSld><p:spTree><p:sp><p:txBody>",
        `<a:p><a:r><a:t>${text}</a:t></a:r></a:p>`,
        "</p:txBody></p:sp></p:spTree></p:cSld>",
        "</p:sld>",
      ].join("");
    const zip = makeZip({
      "ppt/slides/slide2.xml": makeSlide("Second"),
      "ppt/slides/slide1.xml": makeSlide("First"),
      "ppt/slides/slide3.xml": makeSlide("Third"),
    });
    const result = extractPptxText(zip);
    const lines = result.split("\n");
    const slideHeaders = lines.filter((l) => l.startsWith("--- Slide"));
    expect(slideHeaders).toEqual(["--- Slide 1 ---", "--- Slide 2 ---", "--- Slide 3 ---"]);
    expect(result.indexOf("First")).toBeLessThan(result.indexOf("Second"));
    expect(result.indexOf("Second")).toBeLessThan(result.indexOf("Third"));
  });

  it("decodes XML entities", () => {
    const slide = [
      '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
      ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
      "<p:cSld><p:spTree><p:sp><p:txBody>",
      "<a:p><a:r><a:t>A &amp; B</a:t></a:r></a:p>",
      "</p:txBody></p:sp></p:spTree></p:cSld>",
      "</p:sld>",
    ].join("");
    const zip = makeZip({ "ppt/slides/slide1.xml": slide });
    expect(extractPptxText(zip)).toContain("A & B");
  });

  it("handles empty slides", () => {
    const slide = [
      '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
      ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
      "<p:cSld><p:spTree></p:spTree></p:cSld>",
      "</p:sld>",
    ].join("");
    const zip = makeZip({ "ppt/slides/slide1.xml": slide });
    const result = extractPptxText(zip);
    expect(result).toContain("--- Slide 1 ---");
    expect(result.trim()).toBe("--- Slide 1 ---");
  });

  it("handles multiple paragraphs per slide", () => {
    const slide = [
      '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
      ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
      "<p:cSld><p:spTree><p:sp><p:txBody>",
      "<a:p><a:r><a:t>Title</a:t></a:r></a:p>",
      "<a:p><a:r><a:t>Body text</a:t></a:r></a:p>",
      "</p:txBody></p:sp></p:spTree></p:cSld>",
      "</p:sld>",
    ].join("");
    const zip = makeZip({ "ppt/slides/slide1.xml": slide });
    const result = extractPptxText(zip);
    expect(result).toContain("Title");
    expect(result).toContain("Body text");
  });
});
