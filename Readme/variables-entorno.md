# Variables de Entorno

Copia `.env.example` a `.env` y rellena los valores:

```bash
cp .env.example .env
```

## Variables

| Variable | Requerida | Descripción | Ejemplo |
|---|---|---|---|
| `PORT` | No | Puerto del servidor (default: 3000) | `3000` |
| `NODE_ENV` | No | Entorno de ejecución | `development` / `production` |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | ✅ | Service Account JSON convertido a base64 | `eyJhbGci...` |
| `FIREBASE_STORAGE_BUCKET` | ✅ | Nombre del bucket de Firebase Storage (sin `gs://`) | `q-music.appspot.com` |

## Cómo obtener `FIREBASE_SERVICE_ACCOUNT_BASE64`

```bash
# 1. Descarga el JSON desde Firebase Console:
#    Configuración → Cuentas de servicio → Generar nueva clave privada

# 2. Convierte a base64 (Linux/Mac):
base64 -w 0 serviceAccountKey.json

# 3. Pega el resultado en tu .env:
FIREBASE_SERVICE_ACCOUNT_BASE64=<resultado_aqui>
```

> ⚠️ **NUNCA** subas el `.env` ni el `serviceAccountKey.json` al repositorio.
> El `.gitignore` ya los excluye.

## Docker

Al usar Docker Compose, las variables se pasan desde el `.env` local automáticamente:

```bash
docker compose up --build
```

Para producción usa secretos seguros (AWS Secrets Manager, GCP Secret Manager, etc.) en lugar de archivos `.env`.
