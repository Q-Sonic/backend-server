# 💳 Documentación del Sistema de Pagos y Retiros (Payments & Payouts)

Este documento detalla la implementación del motor de pagos, gestión de saldos (wallets) y retiros para artistas en la plataforma Q-Music.

---

## 1. Arquitectura de Saldo (Wallets)

El sistema utiliza una arquitectura de **Dobles Entradas** simplificada en Firestore para garantizar la integridad financiera.

- **`artist_profiles/{uid}.balance`**: Almacena el saldo disponible en tiempo real.
- **`wallet_transactions`**: Historial inmutable de cada movimiento de dinero (entrada por pago, salida por retiro, reversión por rechazo).

---

## 2. Endpoints de Pagos (Ingresos)

### `POST /api/payments/webhook`
Procesa notificaciones automáticas de pasarelas de pago (Nuvei/Stripe/etc).

- **Lógica**: Identifica al artista mediante el `contractId` o referencia, suma el pago al `balance` del artista y registra una transacción de tipo `PAYMENT_RECEIVED`.
- **Atomicidad**: Implementado con **Firestore Transactions** para evitar condiciones de carrera.

---

## 3. Endpoints de Retiro (Payouts)

### `POST /api/payments/withdraw`
**Permisos**: Autenticado + Rol `ARTISTA`.

Inicia una solicitud de retiro de fondos hacia una cuenta bancaria.

**Request Body:**
```json
{
  "amount": 25.50,
  "bankDetails": {
    "bankName": "Banco Pichincha",
    "accountNumber": "1234567890",
    "accountType": "Ahorros",
    "holderName": "José Pérez",
    "holderDocument": "1722334455"
  }
}
```

### `GET /api/payments/withdrawals`
**Permisos**: Autenticado + Rol `ARTISTA`.
Lista el historial de solicitudes de retiro del artista autenticado.

### `GET /api/payments/transactions`
**Permisos**: Autenticado + Rol `ARTISTA`.
Lista el historial de transacciones de la billetera (ingresos, retiros, reversiones).

**Lógica de Negocio:**
1. Valida que el artista tenga saldo suficiente.
2. Resta el monto del `balance` del artista atómicamente.
3. Crea un documento en `withdrawal_requests` con estado `PENDING`.
4. Registra una transacción `WITHDRAWAL` en el historial.
5. Envía una notificación por email al Administrador.

---

## 4. Gestión Administrativa

### `PUT /api/payments/admin/withdrawals/:id`
**Permisos**: Autenticado + Rol `ADMIN`.

Permite al administrador aprobar o rechazar una solicitud de retiro.

### `GET /api/payments/admin/withdrawals`
**Permisos**: Autenticado + Rol `ADMIN`.
Lista todas las solicitudes de retiro del sistema. Soporta filtro opcional `?status=PENDING`.

**Request Body:**
```json
{
  "status": "completed" | "rejected",
  "reason": "Opcional: motivo del rechazo"
}
```

**Estados Finales:**
- **`completed`**: El pago ha sido enviado manualmente por el administrador. El dinero permanece descontado.
- **`rejected`**: La solicitud se cancela. **El sistema revierte el dinero automáticamente al saldo del artista** y genera una transacción de tipo `WITHDRAWAL_REVERT`.

---

## 5. Modelos de Datos (Firestore)

### `withdrawal_requests`
| Campo | Tipo | Descripción |
|---|---|---|
| `artistId` | string | UID del artista que solicita. |
| `amount` | number | Monto bruto solicitado. |
| `bankDetails` | object | Datos de transferencia. |
| `status` | string | `PENDING`, `COMPLETED`, `REJECTED`. |
| `createdAt` | Timestamp | Fecha de creación. |

### `wallet_transactions`
| Campo | Tipo | Descripción |
|---|---|---|
| `userId` | string | Dueño del saldo afectado. |
| `amount` | number | Monto (positivo o negativo). |
| `type` | string | `PAYMENT_RECEIVED`, `WITHDRAWAL`, `WITHDRAWAL_REVERT`. |
| `referenceId` | string | ID del contrato o solicitud de retiro. |
| `createdAt` | Timestamp | Fecha del movimiento. |

---

## 6. Pruebas Rápidas (cURL)

### Retiro de Artista:
```bash
curl -X POST http://localhost:3000/api/payments/withdraw \
  -H "Authorization: Bearer <TOKEN_ARTISTA>" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10, "bankDetails": {...}}'
```

### Aprobación de Admin:
```bash
curl -X PUT http://localhost:3000/api/payments/admin/withdrawals/<REQUEST_ID> \
  -H "Authorization: Bearer <TOKEN_ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```
