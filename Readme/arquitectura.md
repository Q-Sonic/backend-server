# Arquitectura — Q-Music Backend

## Stack

| Capa | Tecnología |
|---|---|
| Runtime | Node.js 20 |
| Framework | Express 5 |
| Lenguaje | TypeScript (strict mode) |
| Base de datos | Firebase Firestore (NoSQL) |
| Autenticación | Firebase Authentication |
| Almacenamiento | Firebase Storage |
| Contenedores | Docker + Docker Compose |

## Patrón Arquitectural

```
HTTP Request
     │
     ▼
┌─────────────┐
│  Middleware  │  helmet · cors · express.json
│  (global)   │  auth.middleware · error.middleware
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Routes    │  /api/auth · /api/users · /api/storage
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Controllers │  Validan input · llaman al service · devuelven respuesta
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Services   │  Lógica de negocio · interacción con Firebase
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Firebase   │  Firestore · Auth · Storage
│  Admin SDK  │
└─────────────┘
```

## Módulos

### `auth`
- Crea usuarios en Firebase Auth + Firestore en un solo paso
- Verifica tokens con `admin.auth().verifyIdToken()`

### `users`
- CRUD completo sobre la colección `users` de Firestore
- El delete sincroniza Firestore + Firebase Auth

### `storage`
- Upload de archivos con `multer` (buffer en memoria)
- Genera signed URLs temporales para acceso seguro

## Flujo de Autenticación

```
Cliente obtiene ID Token de Firebase Auth SDK (frontend)
          │
          ▼
Envía: Authorization: Bearer <ID_TOKEN>
          │
          ▼
auth.middleware → verifyIdToken() → req.user = DecodedToken
          │
          ▼
Controller accede a req.user.uid para operaciones
```
