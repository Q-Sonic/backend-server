# Walkthrough de Mejoras Backend - Stage Go

Se han completado todas las implementaciones solicitadas basándose en el documento de requerimientos. A continuación, el detalle técnico de los cambios:

## 1. Sistema de Notificaciones por Correo (`modules/mail`)
- **Implementado:** `sendWelcomeEmail` y `sendPasswordResetEmail`.
- **Integración:** El sistema ahora envía un correo de bienvenida automático al registrarse y un código de recuperación al solicitar cambio de contraseña.
- **Archivos:** [mail.service.ts](file:///home/jsojo/Documentos/quanticarch/Q-Music-Arch/Q-Music-Backend/src/modules/mail/mail.service.ts) y [auth.service.ts](file:///home/jsojo/Documentos/quanticarch/Q-Music-Arch/Q-Music-Backend/src/modules/auth/auth.service.ts).

## 2. Vinculación Servicios - Contratos (`modules/artist-services`)
- **Mejora:** Se agregaron los campos `contractId` y `technicalRiderId` al modelo de servicios.
- **Funcionalidad:** Los artistas ahora pueden anclar un contrato PDF y un rider técnico específico a cada servicio ofrecido.
- **Archivos:** [artist-services.service.ts](file:///home/jsojo/Documentos/quanticarch/Q-Music-Arch/Q-Music-Backend/src/modules/artist-services/artist-services.service.ts) y [types/index.ts](file:///home/jsojo/Documentos/quanticarch/Q-Music-Arch/Q-Music-Backend/src/types/index.ts).

## 3. Firma Masiva de Contratos (`modules/contracts`)
- **Nuevo Endpoint:** `POST /contracts/sign-all`.
- **Lógica:** Permite al artista firmar (pasar a `ACCEPTED`) todos sus contratos pendientes con una sola acción, optimizando el flujo de trabajo.
- **Archivos:** [contracts.routes.ts](file:///home/jsojo/Documentos/quanticarch/Q-Music-Arch/Q-Music-Backend/src/modules/contracts/contracts.routes.ts), [contracts.controller.ts](file:///home/jsojo/Documentos/quanticarch/Q-Music-Arch/Q-Music-Backend/src/modules/contracts/contracts.controller.ts) y [contracts.service.ts](file:///home/jsojo/Documentos/quanticarch/Q-Music-Arch/Q-Music-Backend/src/modules/contracts/contracts.service.ts).

## 4. Robustez en Pagos y Webhooks (`modules/payments`)
- **Auditoría de Balance:** Se mejoró el webhook de Nuvei (`processWebhook`) para que identifique correctamente si el pago proviene de un Servicio, un Contrato o un Artista directo. Esto resuelve el problema de "balance mal calculado" al asegurar que el ID de referencia (`dev_reference`) se busque en todas las colecciones relevantes.
- **Archivo:** [payments.service.ts](file:///home/jsojo/Documentos/quanticarch/Q-Music-Arch/Q-Music-Backend/src/modules/payments/payments.service.ts).

## 5. Estadísticas Posta y Buscador (`modules/dashboard` & `modules/artist-profiles`)
- **Fix Dashboard:** Se eliminó el hardcodeo de `totalEvents: 0`. Ahora el dashboard cuenta los contratos `ACCEPTED/COMPLETED` reales y muestra el próximo evento en agenda con el **Nombre del Cliente** incluido.
- **Métrica de Popularidad:** Se añadió el campo `totalHires` al perfil del artista, que se incrementa automáticamente cada vez que se firma un contrato.
- **Fix Buscador:** Se corrigió el filtrado de perfiles para que no explote buscando por `displayName` y ahora busca por biografía y ciudad correctamente.
- **Archivos:** [dashboard.service.ts](file:///home/jsojo/Documentos/quanticarch/Q-Music-Arch/Q-Music-Backend/src/modules/dashboard/dashboard.service.ts) y [artist-profiles.service.ts](file:///home/jsojo/Documentos/quanticarch/Q-Music-Arch/Q-Music-Backend/src/modules/artist-profiles/artist-profiles.service.ts).

## 6. Notificaciones de Contratación (`modules/mail`)
- **Mailing Automático:** Ahora, cuando un artista acepta un contrato (firma), el sistema envía un correo de confirmación al Artista y otro al Cliente con los detalles del evento y el ID del contrato. Esto cumple con el pedido de Dylan de asegurar que la información "fluya" al firmar.
- **Archivo:** [mail.service.ts](file:///home/jsojo/Documentos/quanticarch/Q-Music-Arch/Q-Music-Backend/src/modules/mail/mail.service.ts).

## 7. Infraestructura - Ídice de Firestore
> [!IMPORTANT]
> Se identificó un error de pre-condición que bloquea la visualización de retiros de fondos. **Debes crear el siguiente índice en Firebase Console:**
> 
> **Colección:** `withdrawal_requests`
> **Campos:** `artistId` (Ascendente), `createdAt` (Descendente)
> 
> Podés crearlo directamente entrando a este link (que ya estaba en tu reporte):
> [Crear Índice Composite](https://console.firebase.google.com/v1/r/project/q-sonic/firestore/indexes?create_composite=ClNwcm9qZWN0cy9xLXNvbmljL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy93aXRoZHJhd2FsX3JlcXVlc3RzL2luZGV4ZXMvXxABGgwKCGFydGlzdElkEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAg)

## 8. Estabilización de Pasarela de Pagos (Nuvei / Paymentez)
- **Fix Autenticación:** Se corrigió la generación del `Auth-Token`. Se detectó que el hash SHA256 debe incluir únicamente el `SECRET + TIMESTAMP`. Anteriormente se incluía la `SERVER_KEY`, lo que causaba el error 401 (Unauthorized).
- **Cumplimiento de Esquema:** Se agregaron los campos `pending_url` y `review_url` como obligatorios en la configuración de LinkToPay para el ambiente de Staging, evitando errores de validación 400.
- **Archivo:** [payments.service.ts](file:///home/jsojo/Documentos/quanticarch/Q-Music-Arch/Q-Music-Backend/src/modules/payments/payments.service.ts).

---

¡Backend estabilizado y actualizado!
