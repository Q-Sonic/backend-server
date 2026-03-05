# Docker — Guía de Despliegue

## Desarrollo local (sin Docker)

```bash
npm run dev
# Hot reload con ts-node-dev
# Disponible en: http://localhost:3000
```

## Build de producción (sin Docker)

```bash
npm run build    # Compila TypeScript → dist/
npm start        # Corre dist/server.js
```

## Docker

### Construir la imagen

```bash
docker build -t q-music-backend .
```

### Correr el contenedor

```bash
docker run -p 3000:3000 \
  -e FIREBASE_SERVICE_ACCOUNT_BASE64="<tu_base64>" \
  -e FIREBASE_STORAGE_BUCKET="<tu_bucket>" \
  q-music-backend
```

## Docker Compose (recomendado)

```bash
# Asegúrate de tener .env configurado
cp .env.example .env

# Construir y levantar
docker compose up --build

# En background
docker compose up -d --build

# Ver logs
docker compose logs -f api

# Detener
docker compose down
```

## Dockerfile — Multi-Stage

El `Dockerfile` usa dos etapas para minimizar el tamaño de la imagen final:

| Stage | Imagen | Propósito |
|---|---|---|
| `builder` | `node:20-alpine` | Instala deps + compila TypeScript |
| `production` | `node:20-alpine` | Solo `dist/` + deps de producción |

Resultado: imagen ligera (~200MB vs ~600MB sin multi-stage).

## Health Check

```bash
curl http://localhost:3000/api/health
# → {"success":true,"data":{"uptime":1.23},"message":"Q-Music API is running 🎵"}
```
