// Drive schemas
export {
  GetFolderTreeSchema,
  SearchSchema,
  CreateTextFileSchema,
  UpdateTextFileSchema,
  CreateFolderSchema,
  ListFolderSchema,
  DeleteItemSchema,
  RenameItemSchema,
  MoveItemSchema,
  CopyFileSchema,
  GetFileMetadataSchema,
  ExportFileSchema,
  ShareFileSchema,
  GetSharingSchema,
  ListRevisionsSchema,
  RestoreRevisionSchema,
  DownloadFileSchema,
  UploadFileSchema,
  GetStorageQuotaSchema,
  StarFileSchema,
  ResolveFilePathSchema,
  BatchDeleteSchema,
  BatchRestoreSchema,
  BatchMoveSchema,
  BatchShareSchema,
  RemovePermissionSchema,
  ListTrashSchema,
  RestoreFromTrashSchema,
  EmptyTrashSchema,
} from "./drive.js";

export type {
  GetFolderTreeInput,
  SearchInput,
  CreateTextFileInput,
  UpdateTextFileInput,
  CreateFolderInput,
  ListFolderInput,
  DeleteItemInput,
  RenameItemInput,
  MoveItemInput,
  CopyFileInput,
  GetFileMetadataInput,
  ExportFileInput,
  ShareFileInput,
  GetSharingInput,
  ListRevisionsInput,
  RestoreRevisionInput,
  DownloadFileInput,
  UploadFileInput,
  GetStorageQuotaInput,
  StarFileInput,
  ResolveFilePathInput,
  BatchDeleteInput,
  BatchRestoreInput,
  BatchMoveInput,
  BatchShareInput,
  RemovePermissionInput,
  ListTrashInput,
  RestoreFromTrashInput,
  EmptyTrashInput,
} from "./drive.js";

// Docs schemas
export {
  CreateGoogleDocSchema,
  UpdateGoogleDocSchema,
  GetGoogleDocContentSchema,
  AppendToDocSchema,
  InsertTextInDocSchema,
  DeleteTextInDocSchema,
  ReplaceTextInDocSchema,
  FormatGoogleDocRangeSchema,
} from "./docs.js";

export type {
  CreateGoogleDocInput,
  UpdateGoogleDocInput,
  GetGoogleDocContentInput,
  AppendToDocInput,
  InsertTextInDocInput,
  DeleteTextInDocInput,
  ReplaceTextInDocInput,
  FormatGoogleDocRangeInput,
} from "./docs.js";

// Sheets schemas
export {
  ListSheetTabsSchema,
  CreateGoogleSheetSchema,
  UpdateGoogleSheetSchema,
  GetGoogleSheetContentSchema,
  FormatGoogleSheetCellsSchema,
  MergeGoogleSheetCellsSchema,
  AddGoogleSheetConditionalFormatSchema,
  CreateSheetTabSchema,
  DeleteSheetTabSchema,
  RenameSheetTabSchema,
} from "./sheets.js";

export type {
  ListSheetTabsInput,
  CreateGoogleSheetInput,
  UpdateGoogleSheetInput,
  GetGoogleSheetContentInput,
  FormatGoogleSheetCellsInput,
  MergeGoogleSheetCellsInput,
  AddGoogleSheetConditionalFormatInput,
  CreateSheetTabInput,
  DeleteSheetTabInput,
  RenameSheetTabInput,
} from "./sheets.js";

// Slides schemas
export {
  ListSlidePagesSchema,
  CreateGoogleSlidesSchema,
  UpdateGoogleSlidesSchema,
  GetGoogleSlidesContentSchema,
  CreateGoogleSlidesTextBoxSchema,
  CreateGoogleSlidesShapeSchema,
  GetGoogleSlidesSpeakerNotesSchema,
  UpdateGoogleSlidesSpeakerNotesSchema,
  FormatGoogleSlidesElementSchema,
} from "./slides.js";

export type {
  ListSlidePagesInput,
  CreateGoogleSlidesInput,
  UpdateGoogleSlidesInput,
  GetGoogleSlidesContentInput,
  CreateGoogleSlidesTextBoxInput,
  CreateGoogleSlidesShapeInput,
  GetGoogleSlidesSpeakerNotesInput,
  UpdateGoogleSlidesSpeakerNotesInput,
  FormatGoogleSlidesElementInput,
} from "./slides.js";

// Unified schemas
export { CreateFileSchema, UpdateFileSchema, GetFileContentSchema } from "./unified.js";

export type { CreateFileInput, UpdateFileInput, GetFileContentInput } from "./unified.js";

// Calendar schemas
export {
  EventDateTimeSchema,
  AttendeeSchema,
  ReminderSchema,
  ListCalendarsSchema,
  ListEventsSchema,
  GetEventSchema,
  CreateEventSchema,
  UpdateEventSchema,
  DeleteEventSchema,
  FindFreeTimeSchema,
} from "./calendar.js";

export type {
  EventDateTimeInput,
  AttendeeInput,
  ReminderInput,
  ListCalendarsInput,
  ListEventsInput,
  GetEventInput,
  CreateEventInput,
  UpdateEventInput,
  DeleteEventInput,
  FindFreeTimeInput,
} from "./calendar.js";
