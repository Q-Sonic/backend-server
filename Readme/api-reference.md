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
Lista todos los usuarios.

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

---

## Artist Services (US-3 — Precios del artista) 🔒

Solo usuarios con rol **artista** pueden acceder. Cada artista gestiona sus propios servicios (concierto, acústico, evento privado).

### `GET /artist-services`
Lista los servicios del artista autenticado.

**Response 200**
```json
{
  "success": true,
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
  ]
}
```

### `GET /artist-services/:id`
Obtiene un servicio por ID (solo si pertenece al artista).

### `POST /artist-services`
Crea un nuevo servicio.

**Body**
```json
{
  "name": "Concierto",
  "price": 500,
  "description": "Show en vivo con banda completa"
}
```
`name` y `price` son obligatorios. `description` es opcional.

**Response 201**
```json
{
  "success": true,
  "data": { "id": "...", "artistId": "...", "name": "Concierto", "price": 500, "description": "...", "createdAt": "...", "updatedAt": "..." },
  "message": "Artist service created"
}
```

### `PUT /artist-services/:id`
Actualiza un servicio (solo si pertenece al artista). Campos opcionales: `name`, `price`, `description`.

**Body** (todos opcionales)
```json
{
  "name": "Concierto Premium",
  "price": 600,
  "description": "Nueva descripción"
}
```

### `DELETE /artist-services/:id`
Elimina un servicio (solo si pertenece al artista).

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

### `POST /storage/upload` 🔒
Sube un archivo a Firebase Storage.

**Content-Type**: `multipart/form-data`

| Campo | Tipo | Descripción |
|---|---|---|
| `file` | File | Archivo a subir |
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
Elimina un archivo.

**Body**
```json
{ "filePath": "uploads/1234_song.mp3" }
```

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
