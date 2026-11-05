# Organization ID migration

The application now uses stable numeric IDs for organization relationships:

- Each `MasterUnit` row has one `UnitID` and one parent `BidangID`.
- A User's current organization is resolved from `UnitID`; the Bidang is not
  inferred from Profesi or from the Unit's name.
- Document target IDs and the uploader's first-upload Bidang snapshot are stored
  separately from their display labels.
- Runtime authorization never joins records by name.

## Before rollout

1. Make a backup copy of the spreadsheet.
2. In `MasterBidang`, retain the existing Bidang names and assign each one a
   unique positive numeric `BidangID`. IDs must be stable and must not be reused.
   The standard list created for a new sheet is seeded with IDs 1–14.
3. Populate `MasterUnit` with `UnitID`, `Unit`, and `BidangID`. Assign each Unit
   a unique positive numeric ID and select its parent from `MasterBidang`.
   Unit names may repeat under different Bidang; the IDs must not.
4. Create an Admin-reviewed crosswalk for legacy memberships. Include enough
   context to distinguish repeated or ambiguous names, such as the user's NRP,
   legacy Bidang and legacy Unit, and the approved `UnitID`. Resolve every
   ambiguous row with the responsible Admin; do not infer a mapping from a name
   alone. Write the approved IDs into the `UnitID` column in `Users` (appended
   after existing columns when absent). Keep legacy text columns for display and
   audit only.
5. Create an Admin-reviewed crosswalk for existing documents. Map each
   comma-separated target label in `Database_Regulasi` column G to one or more
   approved `BidangID` values and write the comma-separated IDs to column R,
   `BidangTargetIDs`. Leave R blank only when the document is intentionally
   public. An unresolved legacy target is not public: it remains inaccessible to
   non-Admin users until an Admin resolves it.
6. Populate column S, `UploaderBidangID`, only when a reliable first-upload
   snapshot is available and its historical label can be resolved without
   guessing. Do not derive a legacy snapshot from the uploader's current Unit.
   Documents without a reliable snapshot must remain without one.
7. Preserve document row order and all existing `Sosialisasi` rows. Read history
   is historical audit data and must not be deleted or rewritten during this
   migration.

The first 15 document columns remain unchanged. The application adds uploader
metadata in columns P–S (`UploaderNRP`, `UploaderBidang`,
`BidangTargetIDs`, `UploaderBidangID`). For a `Users` sheet whose existing
columns are A–J, `UnitID` is appended in column K.

## Verify before normal use

- Confirm every nonempty `MasterBidang` row has a unique positive ID.
- Confirm every nonempty `MasterUnit` row has a unique positive ID and a valid
  parent `BidangID`.
- Confirm every approved User has a valid `UnitID`.
- Review unresolved document target labels and uploader snapshots; do not clear
  a target label to make an unresolved targeted document public.
- Sign in as Admin and test access with representative Users from each Unit,
  including a User in the uploader's Bidang and Users in each target Bidang.

The application does not change Google Drive sharing in this rollout. Existing
Drive file URLs remain available to anyone who already has the link.

## Known limitations (DocBidang junction)

Document targets are now stored in the `DocBidang` junction sheet (`Timestamp`,
`DocRowIndex`, `BidangID`) instead of the comma-joined `BidangTargetIDs` cell
(column R), which Google Sheets could mis-parse as a date. Column R is retained
in place but is deprecated: it is no longer read or written, and
`ensureDocMetadataHeaders_` keeps its header so column indices (including
`UploaderBidangID` at column S) do not shift.

### Foreign-key stability

`DocRowIndex` is the 1-based spreadsheet row number in `Database_Regulasi` and
is also used by `Sosialisasi` read receipts. It is stable only as long as rows
are not deleted, reordered, or inserted above existing data. If any of those
happens, junction and read-receipt rows silently point at the wrong documents.

Trigger conditions that require migrating to a stable `DocID` (deferred):

- Any document delete feature is added.
- Manual row sorting or moving in the production sheet.
- Row insertion above existing data.

### Migration of legacy targets

Run the admin migration helper (`migrateDocTargetsToJunction`) once after
deploying. It migrates only cells that are still text matching
`/^\\d+(,\\s*\\d+)*$/`; cells already parsed as dates are skipped and logged,
and those documents need manual re-entry of their targets. The helper is
idempotent and returns `{ migrated, skippedAsDate, alreadyMigrated }`.
