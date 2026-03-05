# Testing — Q-Music Backend

Hemos implementado una suite de pruebas robusta utilizando **Jest** y **Supertest**.

## Scripts de Pruebas

| Comando | Descripción |
|---|---|
| `npm test` | Ejecuta todas las pruebas una vez |
| `npm run test:watch` | Ejecuta las pruebas en modo observador (se relanzan al guardar cambios) |
| `npm run test:coverage` | Genera un reporte de cobertura de código en la carpeta `/coverage` |

## Estructura de las Pruebas

Las pruebas se encuentran en `src/__tests__/`:

- **Unit Tests (`*.service.test.ts`)**: Prueban la lógica pura de los servicios mockeando las dependencias externas (Firebase).
- **Integration Tests (`*.api.test.ts`)**: Prueban los endpoints de la API de extremo a extremo, verificando rutas, middlewares y controladores.

## Mocks de Firebase

Para evitar llamadas reales a la red o base de datos durante las pruebas, utilizamos `jest.mock('../config/firebase')`. Esto nos permite simular:
- Creación de usuarios exitosa/fallida.
- Consultas a Firestore.
- Subida de archivos a Storage.

## Ejemplo de Prueba de API

```typescript
it('should return 201 if registration is successful', async () => {
    const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
        role: 'cliente'
    });
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
});
```
