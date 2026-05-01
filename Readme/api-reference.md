# API Reference — Q-Music Backend

Base URL: `http://localhost:3000/api`

> **Autenticación**: Las rutas marcadas con 🔒 requieren el header:
> `Authorization: Bearer <Firebase_ID_Token>`

---

## Health

### `GET /health`
Verifica que el servidor está corriendo.

**Response 200**
```json
{
  "success": true,
  "data": { "uptime": 12.34 },
  "message": "Q-Music API is running 🎵"
}
```

---

## Auth

### `POST /auth/register`
Crea un nuevo usuario en Firebase Auth + Firestore. Al completar el registro con éxito, el usuario **queda autenticado automáticamente** y recibe los tokens de sesión.

**Body**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "displayName": "John Doe",
  "role": "artista"
}
```

**Response 201**
```json
{
  "success": true,
  "data": {
    "idToken": "eyJhbG...",
    "refreshToken": "...",
    "expiresIn": "3600",
    "uid": "abc123",
    "role": "artista",
    "user": {
      "uid": "abc123",
      "email": "user@example.com",
      "displayName": "John Doe",
      "role": "artista"
    }
  },
  "message": "User registered successfully"
}
```

### `POST /auth/login`
Inicia sesión con email y contraseña. Retorna tokens de autenticación y el rol del usuario.

**Body**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "idToken": "eyJhbG...",
    "refreshToken": "...",
    "expiresIn": "3600",
    "uid": "abc123",
    "role": "artista"
  }
}
```

### Roles Disponibles
El sistema utiliza **Firebase Custom Claims** para asignar roles. Los roles permitidos son:
- `cliente` (Default)
- `artista`
- `organizacion`
- `admin`
- `soporte`

### `GET /auth/me` 🔒
Retorna el perfil del usuario autenticado.

**Response 200**
```json
{
  "success": true,
  "data": { "uid": "abc123", "email": "...", "displayName": "..." }
}
```

---

## Users

### `GET /users` 🔒
Lista usuarios con soporte para paginación y filtros.

**Query Params (Opcionales)**
- `skip`: Número de registros a saltar (default: 0).
- `take`: Cantidad de registros a retornar (default: 20).
- `filterField`: Campo para búsqueda por texto (ej: `displayName`).
- `filterValue`: Valor a buscar (prefijo, ej: `Jo`).
- `tagField`: Campo para búsqueda exacta (ej: `email`).
- `tagValue`: Valor exacto (ej: `jose@example.com`).

**Response 200**
```json
{
  "success": true,
  "data": {
    "data": [ { "uid": "...", "email": "..." } ],
    "total": 150,
    "skip": 0,
    "take": 20
  }
}
```

### `GET /users/:id` 🔒
Retorna un usuario por su UID.

### `PUT /users/:id` 🔒
Actualiza datos del usuario.

**Body** (campos opcionales)
```json
{
  "displayName": "Nuevo Nombre",
  "photoURL": "https://..."
}
```

### `DELETE /users/:id` 🔒
Elimina el usuario de Firestore y Firebase Auth.

### `POST /users/artists` 🔒
Crea un nuevo perfil de artista. **Solo rol admin.**

**Body**
```json
{
  "email": "artista@example.com",
  "password": "securePassword123",
  "displayName": "Nombre Artístico"
}
```

**Response 201**
```json
{
  "success": true,
  "data": {
    "uid": "...",
    "email": "artista@example.com",
    "displayName": "Nombre Artístico",
    "role": "artista",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "message": "Artist account created successfully"
}
```

---

## Artist Services (US-3 — Precios del artista) 🔒

Solo usuarios con rol **artista** pueden acceder. Cada artista gestiona sus propios servicios (concierto, acústico, evento privado).

### `GET /artist-services`
<<<<<<< HEAD
Lista los servicios del artista autenticado con soporte para paginación y filtros.

**Query Params (Opcionales)**
- `skip`: Número de registros a saltar (default: 0).
- `take`: Cantidad de registros a retornar (default: 20).
- `filterField`: Campo para búsqueda por texto.
- `filterValue`: Valor a buscar (prefijo).
=======
Lista los servicios del artista autenticado.
Incluye los IDs (`contractId`, `technicalRiderId`) y también los objetos hijos (`contract`, `technicalRider`) cuando existen.
>>>>>>> 6341acb0266757fe273ffb94d6617618ccd911ec

**Response 200**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "docId123",
        "artistId": "artistUid",
        "name": "Concierto",
        "price": 500,
        "description": "Show en vivo con banda completa",
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "total": 10,
    "skip": 0,
    "take": 20
  }
}
```

### `GET /artist-services/artist/:artistId`
Lista pública de servicios de un artista específico. Soporta los mismos parámetros de paginación.

### `GET /artist-services/:id`
Obtiene un servicio por ID (solo si pertenece al artista).

### `POST /artist-services`
Crea un nuevo servicio. Acepta **multipart/form-data** para la imagen (`imageUrl`).

<<<<<<< HEAD
**Body** (form-data)
- `name`: Nombre del servicio (Requerido)
- `price`: Precio (Requerido)
- `description`: Descripción (Opcional)
- `duration`: Duración (Opcional)
- `features`: Array JSON de características (Opcional)
- `file`: Archivo de imagen (Opcional)
=======
**Body**
```json
{
  "name": "Concierto",
  "price": 500,
  "description": "Show en vivo con banda completa",
  "contractId": "fileContract123",
  "technicalRiderId": "fileRider123"
}
```
`name`, `price`, `contractId` y `technicalRiderId` son obligatorios.
Validaciones:
- ambos archivos deben existir
- `contractId` debe ser tipo `contract`
- `technicalRiderId` debe ser tipo `technical_rider`
- ambos deben pertenecer al artista autenticado
>>>>>>> 6341acb0266757fe273ffb94d6617618ccd911ec

**Response 201**
```json
{
  "success": true,
  "data": { ... },
  "message": "Artist service created"
}
```

### `PUT /artist-services/:id`
<<<<<<< HEAD
Actualiza un servicio (solo si pertenece al artista).
=======
Actualiza un servicio (solo si pertenece al artista). Campos opcionales: `name`, `price`, `description`, `duration`, `features`, `contractId`, `technicalRiderId`.

Si envías `contractId` o `technicalRiderId`, el backend valida existencia, tipo correcto y ownership.

**Body** (todos opcionales)
```json
{
  "name": "Concierto Premium",
  "price": 600,
  "description": "Nueva descripción"
}
```
>>>>>>> 6341acb0266757fe273ffb94d6617618ccd911ec

### `DELETE /artist-services/:id`
Elimina un servicio (solo si pertenece al artista) y limpia su imagen del storage.

---

## Artist Files (Contracts & Technical Riders) 🔒

Colección Firestore: `artist_files` (tabla única para ambos tipos).

Todos los registros guardan:
- `id`
- `artistId`
- `type` (`contract` | `technical_rider`)
- `originalName`
- `fileName`
- `mimeType`
- `size`
- `storagePath`
- `url`
- `createdAt`
- `updatedAt`

### `GET /artist-files?type=contract|technical_rider`
Lista archivos del artista autenticado. El filtro `type` es opcional.

### `POST /artist-files`
Sube un archivo del artista.

**Content-Type**: `multipart/form-data`

Campos:
- `file` (obligatorio, PDF, max 10MB)
- `type` (obligatorio: `contract` o `technical_rider`)

El archivo se guarda en:
`artists/{artistId}/files/{type}/{generatedFileName}`

### `PUT /artist-files/:id`
Reemplaza el archivo físico de un registro existente:
1) sube el nuevo archivo  
2) actualiza metadata del registro  
3) elimina del Storage el archivo anterior (`storagePath` viejo)

### `DELETE /artist-files/:id`
Elimina archivo físico + registro en Firestore.

Además desancla en `artist_services`:
- si era tipo `contract`: elimina `contractId` en servicios que lo referencian
- si era tipo `technical_rider`: elimina `technicalRiderId` en servicios que lo referencian

---

## Client Profile (US-6, US-7 — Perfil de cliente) 🔒

Colección `client_profiles` en Firestore (documento por `uid`). La foto se sube como archivo y se guarda en Firebase Storage.

### `GET /client-profiles/me`
Obtiene el perfil del cliente autenticado. **Solo rol cliente.**

**Response 200**
```json
{
  "success": true,
  "data": {
    "uid": "userUid",
    "name": "Juan Pérez",
    "phone": "+34 600 000 000",
    "location": "Madrid, España",
    "photo": "https://storage.googleapis.com/...",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### `GET /client-profiles/:id`
Obtiene el perfil de un cliente por su UID. **Solo roles admin y soporte.**

### `PUT /client-profiles`
Crea o actualiza el perfil del cliente. **Solo rol cliente.** Acepta **JSON** o **multipart/form-data**.

- **JSON:** campos opcionales `name`, `phone`, `location`, `photo` (URL).
- **Multipart:** campo `photo` = archivo de imagen (jpeg, png, webp, gif); se sube a Firebase Storage en `client_profiles/{uid}/` y se guarda la URL en el perfil. Opcionales: `name`, `phone`, `location` como campos de texto.

**Body (JSON)** o **form-data:** `name`, `phone`, `location`, `photo` (archivo o URL).

**Response 200**
```json
{
  "success": true,
  "data": { "uid": "...", "name": "...", "phone": "...", "location": "...", "photo": "...", "createdAt": "...", "updatedAt": "..." },
  "message": "Profile saved"
}
```

---

## Artist Profile (US-10 — Perfil público artista) 🔒

Colección `artist_profiles` en Firestore (documento por `uid`). La foto se sube como archivo y se guarda en Firebase Storage.

### `GET /artist-profiles/me`
Obtiene el perfil del artista autenticado. **Solo rol artista.**

**Response 200**
```json
{
  "success": true,
  "data": {
    "uid": "artistUid",
    "biography": "Biografía del artista...",
    "socialNetworks": {
      "instagram": "https://instagram.com/...",
      "facebook": "https://facebook.com/...",
      "youtube": "https://youtube.com/..."
    },
    "photo": "https://storage.googleapis.com/...",
    "city": "Barcelona",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### `GET /artist-profiles/:id`
Obtiene el perfil de un artista por su UID. **Roles:** cliente, admin y soporte (cualquier artista); artista (solo el propio perfil, `id` = su uid).

### `PUT /artist-profiles`
Crea o actualiza el perfil del artista. **Solo rol artista.** Acepta **JSON** o **multipart/form-data**.

- **JSON:** campos opcionales `biography`, `socialNetworks`, `photo` (URL), `city`.
- **Multipart:** campo `photo` = archivo de imagen (jpeg, png, webp, gif); se sube a Firebase Storage en `artist_profiles/{uid}/` y se guarda la URL. Opcionales: `biography`, `city`, `instagram`, `facebook`, `twitter`, `youtube`, `tiktok`.

**Body (JSON)** o **form-data:** `biography`, `socialNetworks` (o redes por campo), `photo` (archivo o URL), `city`.

**Response 200**
```json
{
  "success": true,
  "data": { "uid": "...", "biography": "...", "socialNetworks": {...}, "photo": "...", "city": "...", "createdAt": "...", "updatedAt": "..." },
  "message": "Profile saved"
}
```

---

## Storage

Los archivos (audio, video, imágenes) se guardan en Firebase Storage. La variable de entorno `FIREBASE_STORAGE_BUCKET` debe coincidir con el nombre del bucket en Firebase Console → Storage: `{projectId}.appspot.com` o `{projectId}.firebasestorage.app` (proyectos recientes). No incluir `gs://`.

**Límites de tamaño:** imágenes 5 MB, videos 50MB, audio 10 MB. Fotos de perfil (cliente/artista): máx. 5 MB. Al actualizar la foto de perfil, la imagen anterior se elimina del Storage automáticamente.

### `POST /storage/upload` 🔒
Sube un archivo a Firebase Storage (multimedia: audio, video, imágenes).

**Content-Type**: `multipart/form-data`

| Campo | Tipo | Descripción |
|---|---|---|
| `file` | File | Archivo a subir (imagen ≤5 MB, video ≤50 MB, audio ≤10 MB) |
| `folder` | string (opcional) | Carpeta destino (default: `uploads`) |

**Response 201**
```json
{
  "success": true,
  "data": { "url": "https://storage.googleapis.com/..." },
  "message": "File uploaded successfully"
}
```

### `DELETE /storage/delete` 🔒
Elimina un archivo por su URL de Storage o por path. La URL debe ser del bucket del proyecto (p. ej. `https://storage.googleapis.com/tu-bucket/carpeta/archivo.jpg`).

**Body**
```json
{ "url": "https://storage.googleapis.com/tu-bucket/client_profiles/uid/photo_123.jpg" }
```
O por path (compatibilidad): `{ "filePath": "uploads/1234_song.mp3" }`

### `POST /storage/signed-url` 🔒
Genera una URL firmada temporal.

**Body**
```json
{
  "filePath": "uploads/1234_song.mp3",
  "expiresInMs": 3600000
}
```

**Response 200**
```json
{
  "success": true,
  "data": { "url": "https://storage.googleapis.com/...?X-Goog-Signature=..." }
}
```

---

## Contracts (US-8 — Historial de contratos y eventos) 🔒

### `GET /contracts/my-history`
Obtiene el historial de contratos y eventos del cliente autenticado con paginación.

**Query Params (Opcionales)**
- `skip`, `take`, `filterField`, `filterValue`.

**Response 200**
```json
{
  "success": true,
  "data": {
    "data": [ { "id": "...", "status": "pending", ... } ],
    "total": 5,
    "skip": 0,
    "take": 20
  },
  "message": "Contracts history retrieved"
}
```

### `GET /contracts/artist-history` 🔒
Obtiene el historial de contratos recibidos por el artista. **Solo rol artista.** Soporta paginación.

### `GET /contracts/:id`
Obtiene el detalle de un contrato. **Solo cliente o artista involucrado.**

### `POST /contracts`
Crea una nueva solicitud de contrato (Booking). **Solo rol cliente.**

### `PATCH /contracts/:id/status`
Actualiza el estado del contrato.
- **Artista:** puede poner `accepted`, `rejected`, `completed`.
- **Cliente:** puede poner `cancelled`.

**Body**
```json
{ "status": "accepted" }
```

### `POST /contracts/:id/payments`
Registra un nuevo pago. **Solo rol artista.**

**Body**
```json
{
  "amount": 500,
  "method": "transfer",
  "reference": "REF123"
}
```

---

## Events (US-8 — Calendario y detalles) 🔒

Gestión de eventos y fechas reservadas.

### `GET /events/calendar`
Obtiene los eventos para el rango de fechas especificado.

**Query Params**
- `start`: Fecha inicio (ISO string o YYYY-MM-DD)
- `end`: Fecha fin (ISO string o YYYY-MM-DD)

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "contractId",
      "eventDetails": {
        "name": "Boda Juan y Ana",
        "date": "...",
        "location": "..."
      }
    }
  ]
}
```

### `GET /events/:id`
Obtiene el detalle extendido de un evento, incluyendo información de contacto del cliente y documentos asociados.

---

## Artist Songs (US-11 — Portfolio Musical) 🔒

Gestión de canciones y portfolio del artista.

### `GET /artist-songs/my-songs`
Lista las canciones del artista autenticado con paginación.

**Query Params (Opcionales)**
- `skip`, `take`, `filterField`, `filterValue`.

### `GET /artist-songs/artist/:artistId`
Lista pública de canciones de un artista.

### `POST /artist-songs`
Sube una nueva canción. Acepta **multipart/form-data**.
- `title`: Título (Opcional, se usa el nombre del archivo si falta).
- `isFeatured`: "true" si es la canción destacada.
- `audio`: Archivo MP3/WAV (Requerido).
- `cover`: Archivo de imagen (Opcional).

### `PUT /artist-songs/:id`
Actualiza metadatos o portada de la canción.

### `DELETE /artist-songs/:id`
Elimina la canción y sus archivos asociados del Storage.

---

## Dashboard 🔒

Endpoints para resúmenes estadísticos.

### `GET /dashboard/stats`
Resumen del dashboard para el artista autenticado (crecimiento de eventos, balance actual y visitas al perfil). **Solo rol artista.**

**Response 200**
```json
{
  "success": true,
  "data": {
    "totalEvents": 12,
    "eventsGrowthPercent": 15,
    "totalBalance": 1540.50,
    "profileVisitsTotal": 450,
    "visitsChartData": [
      { "day": "Mon", "count": 10 },
      { "day": "Tue", "count": 15 }
    ]
  }
}
```

---

## Payments (Nuvei Integration) 🔒

Integración con la pasarela de pagos Nuvei y gestión de saldos.

### `POST /payments/link-to-pay`
Genera un link de pago seguro a través de Nuvei (Link To Pay).

**Body**
```json
{
  "amount": 100.00,
  "description": "Pago reserva Concierto",
  "dev_reference": "contractId_123"
}
```

### `POST /payments/webhook`
**Endpoint Público (Sin 🔒)**. Recibe notificaciones asíncronas de Nuvei sobre el estado de las transacciones. Debe ser configurado en el panel de control de Nuvei.

### `POST /payments/withdraw`
Solicita un retiro del saldo acumulado por el artista.

**Body**
```json
{
  "amount": 500.00
}
```

---

## Respuestas de Error

| Status | Descripción |
|---|---|
| 400 | Bad Request — input inválido |
| 401 | Unauthorized — token faltante o inválido |
| 403 | Forbidden — sin permisos |
| 404 | Not Found |
| 500 | Internal Server Error |

```json
{
  "success": false,
  "error": "Descripción del error"
}
```
