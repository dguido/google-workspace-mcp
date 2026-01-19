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
  handleStarFile
} from './drive.js';

// Docs handlers
export {
  handleCreateGoogleDoc,
  handleUpdateGoogleDoc,
  handleFormatGoogleDocText,
  handleFormatGoogleDocParagraph,
  handleGetGoogleDocContent,
  handleAppendToDoc
} from './docs.js';

// Sheets handlers
export {
  handleCreateGoogleSheet,
  handleUpdateGoogleSheet,
  handleGetGoogleSheetContent,
  handleFormatGoogleSheetCells,
  handleFormatGoogleSheetText,
  handleFormatGoogleSheetNumbers,
  handleSetGoogleSheetBorders,
  handleMergeGoogleSheetCells,
  handleAddGoogleSheetConditionalFormat,
  handleCreateSheetTab,
  handleDeleteSheetTab,
  handleRenameSheetTab
} from './sheets.js';

// Slides handlers
export {
  handleCreateGoogleSlides,
  handleUpdateGoogleSlides,
  handleGetGoogleSlidesContent,
  handleFormatGoogleSlidesText,
  handleFormatGoogleSlidesParagraph,
  handleStyleGoogleSlidesShape,
  handleSetGoogleSlidesBackground,
  handleCreateGoogleSlidesTextBox,
  handleCreateGoogleSlidesShape,
  handleGetGoogleSlidesSpeakerNotes,
  handleUpdateGoogleSlidesSpeakerNotes
} from './slides.js';

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
  convertA1ToGridRange
} from './helpers.js';
