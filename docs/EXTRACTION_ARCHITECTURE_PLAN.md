# Extraction Architecture Plan

**Status:** In Discussion (started 2025-12-29)
**Last Updated:** 2025-12-29

---

## Problem Statement

Deals are living entities with data arriving over time. The current extraction system is all-or-nothing - re-extraction replaces everything. We need a smarter approach that:
- Handles ongoing data additions
- Preserves manual edits
- Supports facility-specific documents in multi-facility deals
- Tracks where data came from

---

## Proposed: Three Extraction Types

### 1. Initial Extraction
- **When:** Deal creation with documents
- **Scope:** All documents together (holistic)
- **Behavior:** Full extraction, populates all fields
- **Status:** ✅ Already implemented

### 2. Re-Extraction
- **When:** Deal was created with sparse/no data, user wants to build out profile
- **Scope:** All documents together (holistic)
- **Behavior:** Like initial extraction BUT respects manual edits
- **Key requirement:** Must not overwrite manually-added data without user approval
- **Status:** ⚠️ Partially exists (current re-extract overwrites everything)

### 3. Incremental Extraction
- **When:** New documents added to existing deal
- **Scope:** Per-document (individual)
- **Behavior:** Adds/updates specific fields without replacing the whole picture
- **Use cases:**
  - Updated monthly financials
  - Facility-specific data
  - Due diligence documents
  - New information that supplements (not replaces) existing data
- **Status:** ❌ Not implemented

---

## Key Components Needed

### 1. Field-Level Tracking
Every extracted field should store:
- `value` - The actual data
- `source_document` - Which document it came from
- `extracted_at` - Timestamp
- `is_manual_edit` - Boolean flag for user-entered data
- `extraction_type` - initial/re-extraction/incremental

This enables:
- Audit trail of where data came from
- "Don't overwrite manual edits without approval" logic
- Conflict resolution

### 2. Extraction Diff/Approval UI
When re-extraction or incremental extraction finds different values:
- Show current value (with source)
- Show new extracted value (with source document)
- Let user accept/reject per field
- Batch approve/reject option

**Open question:** Modal after extraction, or persistent "pending changes" section?

### 3. Upload Context Prompt
When uploading documents, prompt user:

```
What are you uploading?
├── Portfolio/Deal-level document (CIM update, financials, etc.)
├── Facility-specific document
│   └── [Select facility or "New facility"]
└── Updated version of existing document
```

### 4. Upload Reason Categories
Common reasons for uploading additional documents:
- Updated financials (monthly P&L, new period)
- Due diligence documents
- Facility-specific data (inspection, survey, staffing)
- Corrected/updated version of prior doc
- Supporting documentation (appraisals, photos, etc.)

**TODO:** Review if there are other common upload reasons

---

## Design Decisions Made

### Data Conflicts (new vs old)
- Use timestamps in all scenarios for auditing
- AI + user collaboration for resolving conflicts
- AI suggests, user approves changes

### Extraction Scope
- **New/additional documents:** Individual extraction
- **Full re-analysis:** Holistic (all docs together, like current)

### Facility Association
- Prompt user at upload time if doc is facility-specific
- User selects which facility (or multiple facilities)
- Also ask WHY they're uploading (category)

### Manual Edits
- AI re-extraction CAN replace manually-added fields
- BUT only after user has approved the changes
- Never silently overwrite user data

---

## Open Questions

1. **Incremental extraction trigger** - Should it auto-run when docs are uploaded, or require user to explicitly trigger?

2. **Approval UI design** - Modal that pops up after extraction showing changes? Or persistent "pending changes" section to review later?

3. **Auto-create facilities** - If someone uploads a doc for "Facility X" but that facility isn't in the deal yet, should we auto-create it from the extraction?

4. **Token limits with incremental** - How do we handle context for incremental extraction? Does the AI need to "see" existing deal data to know what to update?

5. **Versioning** - Should we keep history of all extractions, or just current state + audit log?

---

## Current System Reference

### Existing Limits
- Per file size: 20MB
- Combined text: 350,000 characters (~87K tokens)
- Per file text cap: 80,000 characters

### Existing Tables
- `deals.extraction_data` - JSON blob with all extracted fields
- `deal_documents` - Uploaded documents
- `deal_monthly_financials` - Time-series financial data
- `deal_monthly_census` - Time-series census data
- `deal_monthly_expenses` - Time-series expense data

### Files to Modify (when implementing)
- `backend/services/extractionOrchestrator.js` - Main extraction logic
- `backend/services/aiExtractor.js` - AI extraction prompts
- `backend/controller/DealController.js` - reExtractDeal endpoint
- `frontend/src/components/DealExtractionViewer/DealExtractionViewer.tsx` - Re-extract button & UI

---

## Next Steps

1. Answer open questions above
2. Design the field-level tracking schema
3. Design the approval UI mockup
4. Prioritize: Re-Extraction improvements vs Incremental Extraction
5. Implementation plan

---

## Session Notes

*Add notes from future discussions here*

