# CrashGuard

## Current State
App has emergency contacts (add/view only, delete is stubbed as "coming soon") and accident history stored in the backend canister. The `reportAccident` function validates that `videoUrl` and `location` are non-empty, which causes a trap when a cancelled event is logged. Contact deletion is not implemented.

## Requested Changes (Diff)

### Add
- `removeEmergencyContact(phone: Text)` backend function — removes a contact by phone number
- `useRemoveEmergencyContact` mutation hook in `useQueries.ts`
- Confirmation before contact deletion in `Contacts.tsx`

### Modify
- `reportAccident` backend validation — skip location/video checks for `status == "cancelled"`
- Delete button in `Contacts.tsx` — wire to `removeEmergencyContact` with a confirm step
- `CountdownModal.tsx` — pass a non-empty location fallback so backend doesn't trap on sent events

### Remove
- "Coming soon" toast on delete button

## Implementation Plan
1. Update `src/backend/main.mo`: add `removeEmergencyContact`, fix `reportAccident` validation
2. Update `src/frontend/src/backend.d.ts`: add `removeEmergencyContact` to interface
3. Update `src/frontend/src/hooks/useQueries.ts`: add `useRemoveEmergencyContact`
4. Update `src/frontend/src/pages/Contacts.tsx`: wire delete with inline confirm state
