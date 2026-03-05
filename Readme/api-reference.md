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
