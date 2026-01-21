// Drive handlers
export {
  handleSearch,
  handleCreateTextFile,
  handleUpdateTextFile,
  handleCreateFolder,
  handleListFolder,
  handleDeleteItem,
  handleRenameItem,
  handleMoveItem,
  handleCopyFile,
  handleGetFileMetadata,
  handleExportFile,
  handleShareFile,
  handleGetSharing,
  handleListRevisions,
  handleRestoreRevision,
  handleDownloadFile,
  handleUploadFile,
  handleGetStorageQuota,
  handleStarFile,
  handleResolveFilePath,
  handleBatchDelete,
  handleBatchRestore,
  handleBatchMove,
  handleBatchShare,
  handleRemovePermission,
  handleListTrash,
  handleRestoreFromTrash,
  handleEmptyTrash,
  handleGetFolderTree,
} from "./drive.js";

// Docs handlers
export {
  handleCreateGoogleDoc,
  handleUpdateGoogleDoc,
  handleGetGoogleDocContent,
  handleAppendToDoc,
  handleInsertTextInDoc,
  handleDeleteTextInDoc,
  handleReplaceTextInDoc,
  handleFormatGoogleDocRange,
} from "./docs.js";

// Sheets handlers
export {
  handleCreateGoogleSheet,
  handleUpdateGoogleSheet,
  handleGetGoogleSheetContent,
  handleFormatGoogleSheetCells,
  handleMergeGoogleSheetCells,
  handleAddGoogleSheetConditionalFormat,
  handleCreateSheetTab,
  handleDeleteSheetTab,
  handleRenameSheetTab,
  handleListSheetTabs,
} from "./sheets.js";

// Slides handlers
export {
  handleCreateGoogleSlides,
  handleUpdateGoogleSlides,
  handleGetGoogleSlidesContent,
  handleCreateGoogleSlidesTextBox,
  handleCreateGoogleSlidesShape,
  handleGetGoogleSlidesSpeakerNotes,
  handleUpdateGoogleSlidesSpeakerNotes,
  handleFormatGoogleSlidesElement,
  handleListSlidePages,
} from "./slides.js";

// Unified handlers
export { handleCreateFile, handleUpdateFile, handleGetFileContent } from "./unified.js";

// Calendar handlers
export {
  handleListCalendars,
  handleListEvents,
  handleGetEvent,
  handleCreateEvent,
  handleUpdateEvent,
  handleDeleteEvent,
  handleFindFreeTime,
} from "./calendar.js";

// Helper utilities
export {
  FOLDER_MIME_TYPE,
  TEXT_MIME_TYPES,
  getExtensionFromFilename,
  getMimeTypeFromFilename,
  validateTextFileExtension,
  resolvePath,
  resolveFolderId,
  checkFileExists,
  convertA1ToGridRange,
} from "./helpers.js";
export type { HandlerContext } from "./helpers.js";
