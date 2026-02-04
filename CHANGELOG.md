# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Fixed 34 tools with `outputSchema` that were incorrectly using `successResponse()` instead of `structuredResponse()`, causing MCP validation errors despite successful operations:
  - **Calendar (1)**: `delete_event`
  - **Docs (8)**: `create_google_doc`, `update_google_doc`, `append_to_doc`, `insert_text_in_doc`, `delete_text_in_doc`, `replace_text_in_doc`, `format_google_doc_range`
  - **Gmail (5)**: `delete_email` (single & batch), `modify_email`, `delete_label`, `delete_filter`
  - **Sheets (8)**: `create_google_sheet`, `update_google_sheet`, `format_google_sheet_cells`, `merge_google_sheet_cells`, `add_google_sheet_conditional_format`, `sheet_tabs` (create/delete/rename)
  - **Slides (12)**: `create_google_slides`, `update_google_slides`, `create_google_slides_text_box`, `create_google_slides_shape`, `slides_speaker_notes` (get/update), `format_slides_text`, `format_slides_shape`, `format_slide_background`
- Fixed 6 tools returning `null` for optional fields instead of omitting them, causing schema validation errors:
  - **Drive (2)**: `search`, `list_folder`, `list_trash`
  - **Calendar (1)**: `list_events`
  - **Contacts (1)**: `list_contacts`
  - **Gmail (1)**: `search_emails`

## [3.0.2] - 2026-02-02

Previous release version.
