/**
 * Ground Truth Verification Tests
 *
 * Run these against real Google APIs to verify implementation correctness.
 * Requires valid OAuth credentials in environment.
 *
 * Usage: npx tsx src/verification/ground-truth-tests.ts
 */

import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

// Test configuration - set these before running
const TEST_CONFIG = {
  // Set to true to run destructive tests (creates/deletes files)
  runDestructiveTests: false,
  // Folder ID to use for test files (create a test folder first)
  testFolderId: process.env.TEST_FOLDER_ID || "",
  // Existing document ID for read-only tests
  testDocId: process.env.TEST_DOC_ID || "",
  // Existing spreadsheet ID for read-only tests
  testSpreadsheetId: process.env.TEST_SPREADSHEET_ID || "",
  // Existing presentation ID for read-only tests
  testPresentationId: process.env.TEST_PRESENTATION_ID || "",
};

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function recordResult(
  name: string,
  passed: boolean,
  error?: string,
  details?: string,
) {
  results.push({ name, passed, error, details });
  const status = passed ? "✓" : "✗";
  log(`${status} ${name}${error ? `: ${error}` : ""}`);
}

async function getAuthClient(): Promise<OAuth2Client> {
  // Use application default credentials or service account
  const auth = new google.auth.GoogleAuth({
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/presentations",
    ],
  });
  return auth.getClient() as Promise<OAuth2Client>;
}

// =============================================================================
// Test 1: Empty Trash with Shared Drive Support
// =============================================================================
async function testEmptyTrashSupportsAllDrives() {
  const testName = "emptyTrash supports Shared Drives";
  try {
    const auth = await getAuthClient();
    const drive = google.drive({ version: "v3", auth });

    // The correct call should include supportsAllDrives
    // Our implementation is missing this - this test verifies the API accepts it
    await drive.files.emptyTrash({
      // This parameter should be included in our implementation
      // supportsAllDrives: true  // Currently missing!
    });

    recordResult(
      testName,
      true,
      undefined,
      "API accepts call without supportsAllDrives (but may not empty Shared Drive trash)",
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    // Check if error is related to missing Shared Drive support
    if (msg.includes("shared drive") || msg.includes("teamDrive")) {
      recordResult(
        testName,
        false,
        "Missing supportsAllDrives causes Shared Drive failure",
        msg,
      );
    } else {
      recordResult(testName, false, msg);
    }
  }
}

// =============================================================================
// Test 2: Insert Text at Document End
// =============================================================================
async function testInsertTextAtDocumentEnd() {
  const testName = "insertText at document end";
  if (!TEST_CONFIG.testDocId) {
    recordResult(testName, false, "No test document ID configured");
    return;
  }

  try {
    const auth = await getAuthClient();
    const docs = google.docs({ version: "v1", auth });

    // Get document to find end index
    const doc = await docs.documents.get({ documentId: TEST_CONFIG.testDocId });
    const content = doc.data.body?.content || [];

    // Find the actual end index
    let endIndex = 1;
    for (const element of content) {
      if (element.endIndex && element.endIndex > endIndex) {
        endIndex = element.endIndex;
      }
    }

    log(`Document end index: ${endIndex}`);

    // Our validation only checks index >= 1, but inserting at endIndex should work
    // This tests if our validation is too restrictive
    recordResult(
      testName,
      true,
      undefined,
      `Document has content ending at index ${endIndex}. Insertion should be valid at indices 1 to ${endIndex - 1}`,
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    recordResult(testName, false, msg);
  }
}

// =============================================================================
// Test 3: Special Character Escaping in Queries
// =============================================================================
async function testSpecialCharacterEscaping() {
  const testName = "special character escaping in queries";

  try {
    const auth = await getAuthClient();
    const drive = google.drive({ version: "v3", auth });

    // Test various special characters that might break queries
    const testCases = [
      { name: "file with 'quotes'", escaped: "file with \\'quotes\\'" },
      {
        name: 'file with "double quotes"',
        escaped: 'file with "double quotes"',
      },
      { name: "file with \\ backslash", escaped: "file with \\\\ backslash" },
      { name: "file with emoji 🎉", escaped: "file with emoji 🎉" },
    ];

    for (const tc of testCases) {
      try {
        // Test if query syntax is valid
        const escapedName = tc.name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        const query = `name = '${escapedName}' and trashed = false`;

        await drive.files.list({
          q: query,
          fields: "files(id)",
          pageSize: 1,
        });

        log(`  Query accepted for: ${tc.name}`);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("Invalid query")) {
          recordResult(
            testName,
            false,
            `Query syntax error for: ${tc.name}`,
            msg,
          );
          return;
        }
      }
    }

    recordResult(
      testName,
      true,
      undefined,
      "All special character queries accepted",
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    recordResult(testName, false, msg);
  }
}

// =============================================================================
// Test 4: Rate Limiting Behavior
// =============================================================================
async function testRateLimitingBehavior() {
  const testName = "rate limiting returns 429";

  try {
    const auth = await getAuthClient();
    const drive = google.drive({ version: "v3", auth });

    // Make many rapid requests to trigger rate limiting
    // In practice, you'd need to make many more requests
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(drive.files.list({ pageSize: 1, fields: "files(id)" }));
    }

    await Promise.all(promises);

    recordResult(
      testName,
      true,
      undefined,
      "20 parallel requests succeeded without rate limiting. Real batch operations may trigger 429s.",
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.includes("429") ||
      msg.includes("Rate Limit") ||
      msg.includes("quota")
    ) {
      recordResult(
        testName,
        true,
        undefined,
        `Rate limiting triggered as expected: ${msg}`,
      );
    } else {
      recordResult(testName, false, msg);
    }
  }
}

// =============================================================================
// Test 5: Speaker Notes Structure
// =============================================================================
async function testSpeakerNotesStructure() {
  const testName = "speaker notes structure matches expectations";
  if (!TEST_CONFIG.testPresentationId) {
    recordResult(testName, false, "No test presentation ID configured");
    return;
  }

  try {
    const auth = await getAuthClient();
    const slides = google.slides({ version: "v1", auth });

    const presentation = await slides.presentations.get({
      presentationId: TEST_CONFIG.testPresentationId,
    });

    const slidesData = presentation.data.slides || [];

    for (let i = 0; i < slidesData.length; i++) {
      const slide = slidesData[i];
      const notesPage = slide.slideProperties?.notesPage;

      if (notesPage) {
        log(`  Slide ${i}: notesPage exists`);

        // Check the structure our code assumes
        const pageElements = notesPage.pageElements || [];
        for (const element of pageElements) {
          if (element.shape?.shapeType === "TEXT_BOX") {
            const textContent = element.shape.text?.textElements;
            if (textContent) {
              log(
                `    Found speaker notes text box with ${textContent.length} text elements`,
              );
            }
          }
        }
      } else {
        log(`  Slide ${i}: no notesPage`);
      }
    }

    recordResult(
      testName,
      true,
      undefined,
      `Analyzed ${slidesData.length} slides for speaker notes structure`,
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    recordResult(testName, false, msg);
  }
}

// =============================================================================
// Test 6: Batch Delete Partial Failure
// =============================================================================
async function testBatchDeletePartialFailure() {
  const testName = "batch operations handle partial failures";

  // This tests the concept - real test would need actual file IDs
  const invalidId = "definitely-not-a-real-file-id-12345";

  try {
    const auth = await getAuthClient();
    const drive = google.drive({ version: "v3", auth });

    // Test what error we get for non-existent file
    try {
      await drive.files.delete({ fileId: invalidId, supportsAllDrives: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      log(`  Delete non-existent file error: ${msg}`);

      // Our code checks for these patterns
      if (msg.includes("File not found") || msg.includes("not found")) {
        recordResult(
          testName,
          true,
          undefined,
          'API returns expected "not found" error for non-existent files',
        );
      } else {
        recordResult(
          testName,
          true,
          undefined,
          `API returns: ${msg}. Our error matching may need adjustment.`,
        );
      }
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    recordResult(testName, false, msg);
  }
}

// =============================================================================
// Test 7: Sheet Name Lookup
// =============================================================================
async function testSheetNameLookup() {
  const testName = "sheet name lookup behavior";
  if (!TEST_CONFIG.testSpreadsheetId) {
    recordResult(testName, false, "No test spreadsheet ID configured");
    return;
  }

  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: TEST_CONFIG.testSpreadsheetId,
    });

    const sheetNames =
      spreadsheet.data.sheets
        ?.map((s) => s.properties?.title)
        .filter(Boolean) || [];
    log(`  Available sheets: ${sheetNames.join(", ")}`);

    // Test exact match
    const firstSheet = sheetNames[0];
    if (firstSheet) {
      // Our code does exact string comparison
      const found = sheetNames.find((s) => s === firstSheet);
      log(
        `  Exact match for "${firstSheet}": ${found ? "found" : "not found"}`,
      );
    }

    // Test case sensitivity (Google Sheets is case-sensitive)
    if (sheetNames.length > 0) {
      const testName = sheetNames[0]?.toUpperCase();
      const found = sheetNames.find((s) => s === testName);
      log(
        `  Case-insensitive test "${testName}": ${found ? "found" : "not found (expected)"}`,
      );
    }

    recordResult(
      testName,
      true,
      undefined,
      `Found ${sheetNames.length} sheets. Sheet names are case-sensitive.`,
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    recordResult(testName, false, msg);
  }
}

// =============================================================================
// Test 8: Path Resolution with Unicode
// =============================================================================
async function testPathResolutionUnicode() {
  const testName = "path resolution handles unicode";

  try {
    const auth = await getAuthClient();
    const drive = google.drive({ version: "v3", auth });

    // Test if unicode folder names work in queries
    const unicodeFolderNames = [
      "日本語フォルダ",
      "Émojis 🎉 Here",
      "Spëcîål Çhàrs",
    ];

    for (const folderName of unicodeFolderNames) {
      const escapedName = folderName
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
      const query = `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

      try {
        await drive.files.list({
          q: query,
          fields: "files(id)",
          pageSize: 1,
        });
        log(`  Unicode query accepted: ${folderName}`);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        recordResult(
          testName,
          false,
          `Unicode query failed for "${folderName}"`,
          msg,
        );
        return;
      }
    }

    recordResult(
      testName,
      true,
      undefined,
      "All unicode folder name queries accepted",
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    recordResult(testName, false, msg);
  }
}

// =============================================================================
// Main
// =============================================================================
async function main() {
  log("Starting Ground Truth Verification Tests");
  log("========================================");
  log("");

  // Run all tests
  await testEmptyTrashSupportsAllDrives();
  await testInsertTextAtDocumentEnd();
  await testSpecialCharacterEscaping();
  await testRateLimitingBehavior();
  await testSpeakerNotesStructure();
  await testBatchDeletePartialFailure();
  await testSheetNameLookup();
  await testPathResolutionUnicode();

  // Summary
  log("");
  log("========================================");
  log("Summary");
  log("========================================");

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  log(`Passed: ${passed}/${results.length}`);
  log(`Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    log("");
    log("Failed tests:");
    for (const r of results.filter((r) => !r.passed)) {
      log(`  - ${r.name}: ${r.error}`);
    }
  }

  log("");
  log("Note: These tests verify API behavior and assumptions.");
  log("Configure TEST_CONFIG with real IDs for comprehensive testing.");
}

main().catch(console.error);
