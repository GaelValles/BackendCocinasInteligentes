# Backend Requirements: Design Upload Flow - Preliminary & Final Stages
**Date:** April 7, 2026  
**Related Frontend Files:**
- `src/app/admin/operaciones/page.tsx`
- `src/components/admin/FinalDesignUploadModal.tsx`

---

## 1. Overview

The frontend now implements a two-stage design approval workflow:
1. **Preliminary Design**: Admin uploads → Admin approves
2. **Final Design**: After visit occurs → Admin/Employee uploads final design → Auto-moves task to "cotizacion_formal"

This document specifies backend changes needed to support this workflow.

---

## 2. Database Model Changes

### 2.1 ClienteArchivo Collection

**New Field: `nivel`**

Add an optional field to differentiate design stages:

```typescript
type ClienteArchivo = {
  _id: ObjectId;
  clienteId: string;
  tareasId?: string;
  tipo: "diseno" | "levantamiento_detallado" | "render" | "otro";
  nivel?: "preliminar" | "final"; // NEW FIELD
  nombre: string;
  url: string;
  key: string;
  provider: "dropbox" | "cloudinary" | "local";
  mimeType: string;
  createdAt: ISODate;
  updatedAt: ISODate;
};
```

**Rationale:**
- Allows tracking which design phase each file belongs to
- Enables filtering (e.g., "show only final designs")
- Supports potential future versioning (preliminary v1, v2, v3 → final)

**Constraints:**
- `nivel` defaults to `null` for backward compatibility (existing files pre-date this field)
- For new uploads with `tipo: "diseno"`, `nivel` should be populated from request body

### 2.2 Tarea.archivos (Legacy)

No changes needed. The field remains as fallback for sync-only purposes. Frontend reads from ClienteArchivo.

---

## 3. API Endpoint Changes

### 3.1 POST /api/archivos/upload

**New Request Body Field:**

```json
{
  "tipo": "diseno",
  "nivel": "preliminar" | "final",  // NEW (optional for backward compatibility)
  "relacionadoA": "tarea",
  "relacionadoId": "taskId",
  "clienteId": "clientId",
  "tareasId": "taskId"
}
```

**Behavior:**
- Accept `nivel` in request body
- If provided and `tipo === "diseno"`, store `nivel` in ClienteArchivo document
- If not provided, default to `null`
- **No validation on uniqueness yet** (allow multiple preliminars, multiple finals - discussed in section 4)

**Response Remains Unchanged:**

```json
{
  "_id": "archId",
  "tareasId": "taskId",
  "clienteId": "clientId",
  "tipo": "diseno",
  "nivel": "preliminar",  // INCLUDE in response
  "provider": "dropbox",
  "key": "...",
  "url": "...",
  "relacionadoA": "tarea",
  "relacionadoId": "taskId"
}
```

**Implementation Notes:**
- Parse `nivel` from `req.body`
- Validate: `nivel` must be one of `["preliminar", "final", null]`
- Pass to ClienteArchivo persistence layer
- Return `nivel` in response (frontend tracks it)

---

### 3.2 GET /api/archivos/tarea/{tareaId}

**Response Format (Already Implemented):**

Response should continue supporting both shapes:
- Direct array: `[{ _id, nivel, ... }]`
- Nested object: `{ archivos: [{ _id, nivel, ... }] }`

**Additional Behavior (Optional Enhancement):**

Accept optional query param to filter by phase:
```
GET /api/archivos/tarea/123?nivel=final
GET /api/archivos/tarea/123?nivel=preliminar
```

Current frontend doesn't use this, but good to support for future filtering.

---

### 3.3 GET /api/archivos/cliente/{clienteId}

**Same Behavior as 3.2**
- Response includes `nivel` field for each archivo
- Optional query param `?nivel=final` for filtering

---

## 4. Business Logic Considerations

### 4.1 Design Phase Uniqueness (Optional for MVP)

**Current Requirement:** "Only one design final per task"

**Two Implementation Approaches:**

#### Option A: Enforce at Storage Layer (Recommended for MVP+1)
- Before inserting a `nivel: "final"` file, check if one exists for this `tareasId`
- If exists, either:
  - **Replace**: Delete old final, insert new (version overwrite)
  - **Reject**: Return 409 Conflict error
- Return clarifying message to frontend

**Example Implementation:**
```javascript
// In POST /api/archivos/upload, before persist:
if (nivel === "final" && tareasId) {
  const existing = await ClienteArchivo.findOne({
    tareasId,
    nivel: "final",
    tipo: "diseno"
  });
  if (existing) {
    // Option: Delete old or reject
    // await ClienteArchivo.deleteOne({ _id: existing._id });
    throw new Error("Diseño final ya existe para esta tarea. Por favor reemplazar manualmente.");
  }
}
```

#### Option B: No Enforcement (Current MVP)
- Store as-is
- Frontend can upload multiple
- **Note:** Frontend currently doesn't have retry/overwrite UI, so this is acceptable for MVP
- Plan Option A for next sprint

**Recommendation:** Start with Option B (simpler), plan Option A for future sprint.

### 4.2 Authorization & Access Control

**Current Scope:** Assume admin/employee can upload (no additional auth checks)

**Future Enhancement (Planned):**
- Only `role: "admin"` or `role: "empleado"` with proper token can upload designs
- `nivel: "final"` uploads require additional scope or role (e.g., `admin` only)

---

## 5. Frontend-Backend Data Flow

### 5.1 Upload Final Design Flow

```
Frontend                          Backend
─────────────────────────────────────────────

1. Admin clicks "Aprobar cliente"
   (shown only after visit date passes)
   
2. FinalDesignUploadModal opens

3. Admin selects file & clicks
   "Cargar diseño final"
   
4. Frontend calls:
   POST /api/archivos/upload
   {
     "tipo": "diseno",
     "nivel": "final",        ← NEW
     "relacionadoA": "tarea",
     "relacionadoId": "taskId",
     "clienteId": "clientId",
     "tareasId": "taskId"
   }
   
5.                            Backend persists to ClienteArchivo
                              - Saves nivel: "final"
                              - Returns response with nivel
   
6.                            POST /api/tareas/{taskId}/archivos
                              (legacy sync, non-blocking)
                              
7. Frontend receives 200 OK

8. Frontend calls:
   PATCH /api/tareas/{taskId}
   {
     "designApprovedByClient": true,
     "stage": "cotizacion_formal"
   }
   
9.                            Backend updates Tarea document
                              - Sets designApprovedByClient: true
                              - Moves stage to "cotizacion_formal"
   
10. Frontend shows success alerts
    and moves card to "Cotización Formal" column
```

### 5.2 Approval Status Reflection

Frontend checks these fields to show button state:
- `task.designApprovedByAdmin` or `task.visita?.aprobadaPorAdmin`
- `task.visitScheduledAt` (past vs future)
- `task.designApprovedByClient` or `task.visita?.aprobadaPorCliente`

**No new fields needed** for approval status; `nivel` on files is informational only.

---

## 6. Response Examples

### Upload Response (POST /api/archivos/upload)

**Request:**
```json
{
  "tipo": "diseno",
  "nivel": "final",
  "relacionadoA": "tarea",
  "relacionadoId": "task-123",
  "clienteId": "client-456",
  "tareasId": "task-123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "archId-789",
    "clienteId": "client-456",
    "tareasId": "task-123",
    "tipo": "diseno",
    "nivel": "final",
    "nombre": "Diseño_Final_2026_04_07.pdf",
    "url": "https://...dropbox.../Diseño_Final_2026_04_07.pdf",
    "key": "dropbox/path/...",
    "provider": "dropbox",
    "mimeType": "application/pdf",
    "relacionadoA": "tarea",
    "relacionadoId": "task-123",
    "createdAt": "2026-04-07T14:30:00Z",
    "updatedAt": "2026-04-07T14:30:00Z"
  }
}
```

### Get Files by Task (GET /api/archivos/tarea/task-123)

**Response (Array Format):**
```json
[
  {
    "_id": "archId-1",
    "clienteId": "client-456",
    "tareasId": "task-123",
    "tipo": "diseno",
    "nivel": "preliminar",
    "nombre": "Diseño_Preliminar.pdf",
    "url": "...",
    "key": "...",
    "provider": "dropbox",
    "createdAt": "2026-04-05T10:00:00Z"
  },
  {
    "_id": "archId-2",
    "clienteId": "client-456",
    "tareasId": "task-123",
    "tipo": "diseno",
    "nivel": "final",
    "nombre": "Diseño_Final.pdf",
    "url": "...",
    "key": "...",
    "provider": "dropbox",
    "createdAt": "2026-04-07T14:30:00Z"
  }
]
```

---

## 7. Migration & Rollout

### 7.1 Backward Compatibility

- ✅ Old uploads (without `nivel`) will have `nivel: null`
- ✅ Frontend normalizes `null` to "preliminar" for display (if needed)
- ✅ No breaking changes to existing endpoints

### 7.2 Deployment Checklist

1. ✅ Add `nivel?: string` field to ClienteArchivo schema
2. ✅ Update POST /api/archivos/upload to accept & store `nivel`
3. ✅ Ensure GET endpoints return `nivel` in response
4. ✅ Test upload with `nivel: "final"` for existing tasks
5. ✅ Verify Dropbox integration still works (provider, key, url)
6. ⚠️ Consider adding logging for `nivel` to debug uploads
7. ⚠️ Plan Option A (uniqueness enforcement) for next sprint

---

## 8. Testing Scenarios

### 8.1 Happy Path
- [ ] Upload design with `nivel: "preliminar"` → ClienteArchivo stores it
- [ ] Fetch designs by task → Returns file with `nivel: "preliminar"`
- [ ] Upload another design with `nivel: "final"` → ClienteArchivo stores it
- [ ] Fetch designs by task → Returns both files with correct `nivel` values

### 8.2 Edge Cases
- [ ] Upload without `nivel` parameter → Stores as `null`
- [ ] Upload with `nivel: null` explicitly → Stores as `null`
- [ ] Upload with invalid `nivel` value → Returns validation error
- [ ] Two "final" uploads to same task → (Depends on Option A/B decision)

### 8.3 Authorization
- [ ] Non-admin user tries to upload final design → (Future: should reject if you add auth)
- [ ] Missing `tareasId` → API should handle gracefully

---

## 9. Future Enhancements

1. **Uniqueness Enforcement (Option A)**: Prevent/replace multiple final designs per task
2. **File Versioning UI**: Show version history (preliminary v1 → v2 vs final)
3. **Design Approval Chain**: Require client signature before final design upload
4. **Automatic Notifications**: Email client when final design is ready
5. **Archive Old Designs**: Delete preliminary versions after final is approved
6. **Audit Trail**: Log who uploaded each version and when

---

## 10. Summary Table

| Aspect | Current (Frontend) | New (Backend) | Priority |
|--------|-------------------|---------------|----------|
| ClienteArchivo.nivel field | Track in response | Add & persist | 🔴 High |
| POST /api/archivos/upload | Submit tipo only | Accept + store nivel | 🔴 High |
| GET /api/archivos/tarea | Read files | Include nivel in response | 🔴 High |
| Uniqueness check (1 final per task) | Not enforced | Optional enforcement | 🟡 Medium |
| Authorization on nivel="final" | Not checked | Future check | 🟢 Low |

---

## 11. Questions for Backend Team

1. Should `nivel` be required (NOT NULL) or optional (NULL for edge cases)?
   - **Recommendation:** Optional for MVP, normalize to "preliminar" at storage layer
   
2. If multiple "final" uploads to same task → Replace or Reject?
   - **Recommendation:** Start with Replace (simpler), plan Replace-with-confirmation for future

3. Should old files (pre-2026-04-07) have `nivel: "preliminar"` or `nivel: null`?
   - **Recommendation:** Leave as `null`, frontend treats both equally for display

4. Do you want filtering endpoints (GET /api/archivos/tarea/{id}?nivel=final)?
   - **Recommendation:** Not critical for MVP, but good to plan

5. Any audit logging needed for "final design uploaded"?
   - **Recommendation:** Yes, useful for compliance/traceability (log in POST endpoint)

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-07  
**Next Review:** After sprint 1 implementation
