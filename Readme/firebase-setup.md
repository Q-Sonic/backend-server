# Configuración de Firebase

## 1. Crear proyecto en Firebase Console

1. Ve a [https://console.firebase.google.com](https://console.firebase.google.com)
2. Clic en **"Agregar proyecto"**
3. Asigna un nombre (ej: `q-music-prod`)
4. (Opcional) Desactiva Google Analytics si no lo necesitas

## 2. Activar Firestore

1. Firebase Console → **Firestore Database** → **Crear base de datos**
2. Selecciona modo: **Producción** (recomendado) o **Prueba (test)**
3. Elige la región más cercana a tus usuarios (ej: `us-east1`)

### Reglas de Firestore recomendadas (producción)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 3. Activar Firebase Authentication

1. Firebase Console → **Authentication** → **Comenzar**
2. Pestaña **"Sign-in method"** → activa **Email/Password**

## 4. Activar Firebase Storage

1. Firebase Console → **Storage** → **Comenzar**
2. Elige la región (idealmente la misma que Firestore)
3. El nombre del bucket aparece en la pantalla (ej: `q-music.appspot.com`)
4. Cópialo como `FIREBASE_STORAGE_BUCKET` en tu `.env`

### Reglas de Storage recomendadas

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 5. Generar Service Account (clave privada)

1. Firebase Console → ⚙️ **Configuración del proyecto**
2. Pestaña **"Cuentas de servicio"**
3. Clic en **"Generar nueva clave privada"** → descarga el JSON
4. Conviértelo a base64:
   ```bash
   base64 -w 0 serviceAccountKey.json
   ```
5. Pega el resultado en `FIREBASE_SERVICE_ACCOUNT_BASE64` de tu `.env`
