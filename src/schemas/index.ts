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
  SheetTabsSchema,
  CreateGoogleSheetSchema,
  UpdateGoogleSheetSchema,
  GetGoogleSheetContentSchema,
  FormatGoogleSheetCellsSchema,
  MergeGoogleSheetCellsSchema,
  AddGoogleSheetConditionalFormatSchema,
} from "./sheets.js";

export type {
  SheetTabsInput,
  CreateGoogleSheetInput,
  UpdateGoogleSheetInput,
  GetGoogleSheetContentInput,
  FormatGoogleSheetCellsInput,
  MergeGoogleSheetCellsInput,
  AddGoogleSheetConditionalFormatInput,
} from "./sheets.js";

// Slides schemas
export {
  ListSlidePagesSchema,
  CreateGoogleSlidesSchema,
  UpdateGoogleSlidesSchema,
  GetGoogleSlidesContentSchema,
  CreateGoogleSlidesTextBoxSchema,
  CreateGoogleSlidesShapeSchema,
  SlidesSpeakerNotesSchema,
  FormatSlidesTextSchema,
  FormatSlidesShapeSchema,
  FormatSlideBackgroundSchema,
} from "./slides.js";

export type {
  ListSlidePagesInput,
  CreateGoogleSlidesInput,
  UpdateGoogleSlidesInput,
  GetGoogleSlidesContentInput,
  CreateGoogleSlidesTextBoxInput,
  CreateGoogleSlidesShapeInput,
  SlidesSpeakerNotesInput,
  FormatSlidesTextInput,
  FormatSlidesShapeInput,
  FormatSlideBackgroundInput,
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

// Gmail schemas
export {
  EmailAddressSchema,
  AttachmentSchema,
  SendEmailSchema,
  DraftEmailSchema,
  ReadEmailSchema,
  SearchEmailsSchema,
  DeleteEmailSchema,
  ModifyEmailSchema,
  DownloadAttachmentSchema,
  CreateLabelSchema,
  UpdateLabelSchema,
  DeleteLabelSchema,
  ListLabelsSchema,
  GetOrCreateLabelSchema,
  FilterCriteriaSchema,
  FilterActionSchema,
  FilterTemplateType,
  CreateFilterSchema,
  ListFiltersSchema,
  DeleteFilterSchema,
} from "./gmail.js";

export type {
  EmailAddressInput,
  AttachmentInput,
  SendEmailInput,
  DraftEmailInput,
  ReadEmailInput,
  SearchEmailsInput,
  DeleteEmailInput,
  ModifyEmailInput,
  DownloadAttachmentInput,
  CreateLabelInput,
  UpdateLabelInput,
  DeleteLabelInput,
  ListLabelsInput,
  GetOrCreateLabelInput,
  FilterCriteriaInput,
  FilterActionInput,
  FilterTemplateTypeValue,
  CreateFilterInput,
  ListFiltersInput,
  DeleteFilterInput,
} from "./gmail.js";
