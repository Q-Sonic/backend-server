import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: '🎵 Q-Music Backend API',
            version: '1.0.0',
            description: 'API RESTful para Q-Music — Express + TypeScript + Firebase',
            contact: {
                name: 'Q-Music Team',
            },
        },
        servers: [
            {
                url: '/api',
                description: 'API base path',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Firebase ID Token obtenido desde el cliente Firebase Auth SDK',
                },
            },
            schemas: {
                ApiResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        data: { type: 'object' },
                        message: { type: 'string', example: 'OK' },
                    },
                },
                ApiError: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        error: { type: 'string', example: 'Error description' },
                    },
                },
                UserRecord: {
                    type: 'object',
                    properties: {
                        uid: { type: 'string', example: 'abc123uid' },
                        email: { type: 'string', format: 'email', example: 'user@example.com' },
                        displayName: { type: 'string', example: 'John Doe' },
                        role: { type: 'string', example: 'cliente' },
                        photoURL: { type: 'string', example: 'https://...' },
                        createdAt: { type: 'string', example: '2026-01-01T00:00:00Z' },
                        updatedAt: { type: 'string', example: '2026-01-01T00:00:00Z' },
                    },
                },
                RegisterBody: {
                    type: 'object',
                    required: ['email', 'password', 'displayName', 'role'],
                    properties: {
                        email: { type: 'string', format: 'email', example: 'user@example.com' },
                        password: { type: 'string', minLength: 6, example: 'securePass123' },
                        displayName: { type: 'string', example: 'John Doe' },
                        role: { type: 'string', enum: ['cliente', 'artista', 'organizacion', 'admin', 'soporte'], example: 'cliente' },
                    },
                },
                LoginBody: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email', example: 'user@example.com' },
                        password: { type: 'string', example: 'securePass123' },
                    },
                },
                LoginResponse: {
                    type: 'object',
                    properties: {
                        idToken: { type: 'string', example: 'eyJhbGci...' },
                        refreshToken: { type: 'string', example: 'AE82...' },
                        expiresIn: { type: 'string', example: '3600' },
                        uid: { type: 'string', example: 'abc123uid' },
                        role: { type: 'string', example: 'cliente' },
                    },
                },
                UpdateUserBody: {
                    type: 'object',
                    properties: {
                        displayName: { type: 'string', example: 'New Name' },
                        photoURL: { type: 'string', example: 'https://example.com/photo.jpg' },
                    },
                },
                UploadResponse: {
                    type: 'object',
                    properties: {
                        url: { type: 'string', example: 'https://storage.googleapis.com/...' },
                    },
                },
                FilePathBody: {
                    type: 'object',
                    required: ['filePath'],
                    properties: {
                        filePath: { type: 'string', example: 'uploads/1234_song.mp3' },
                    },
                },
                SignedUrlBody: {
                    type: 'object',
                    required: ['filePath'],
                    properties: {
                        filePath: { type: 'string', example: 'uploads/1234_song.mp3' },
                        expiresInMs: { type: 'number', example: 3600000 },
                    },
                },
            },
        },
        tags: [
            { name: 'Health', description: 'Estado del servidor' },
            { name: 'Auth', description: 'Registro y perfil de usuario' },
            { name: 'Users', description: 'CRUD de usuarios (requiere auth)' },
            { name: 'Storage', description: 'Gestión de archivos en Firebase Storage' },
        ],
        paths: {
            '/health': {
                get: {
                    tags: ['Health'],
                    summary: 'Health check',
                    description: 'Verifica que el servidor está corriendo',
                    responses: {
                        '200': {
                            description: 'Servidor activo',
                            content: {
                                'application/json': {
                                    schema: {
                                        allOf: [
                                            { $ref: '#/components/schemas/ApiResponse' },
                                            {
                                                properties: {
                                                    data: {
                                                        type: 'object',
                                                        properties: {
                                                            uptime: { type: 'number', example: 12.34 },
                                                        },
                                                    },
                                                },
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
            },
            '/auth/register': {
                post: {
                    tags: ['Auth'],
                    summary: 'Registrar nuevo usuario con rol asignado',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/RegisterBody' },
                            },
                        },
                    },
                    responses: {
                        '201': {
                            description: 'Usuario creado',
                            content: {
                                'application/json': {
                                    schema: {
                                        allOf: [
                                            { $ref: '#/components/schemas/ApiResponse' },
                                            { properties: { data: { $ref: '#/components/schemas/UserRecord' } } },
                                        ],
                                    },
                                },
                            },
                        },
                        '400': { description: 'Datos inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
            '/auth/login': {
                post: {
                    tags: ['Auth'],
                    summary: 'Iniciar sesión usando Firebase REST API',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/LoginBody' },
                            },
                        },
                    },
                    responses: {
                        '200': {
                            description: 'Login exitoso, retorna ID Token y Refresh Token',
                            content: {
                                'application/json': {
                                    schema: {
                                        allOf: [
                                            { $ref: '#/components/schemas/ApiResponse' },
                                            { properties: { data: { $ref: '#/components/schemas/LoginResponse' } } },
                                        ],
                                    },
                                },
                            },
                        },
                        '400': { description: 'Faltan credenciales', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '401': { description: 'Credenciales inválidas', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
            '/auth/me': {
                get: {
                    tags: ['Auth'],
                    summary: 'Obtener perfil del usuario autenticado',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        '200': {
                            description: 'Perfil del usuario',
                            content: {
                                'application/json': {
                                    schema: {
                                        allOf: [
                                            { $ref: '#/components/schemas/ApiResponse' },
                                            { properties: { data: { $ref: '#/components/schemas/UserRecord' } } },
                                        ],
                                    },
                                },
                            },
                        },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
            '/users': {
                get: {
                    tags: ['Users'],
                    summary: 'Listar todos los usuarios (Solo admin/soporte)',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        '200': {
                            description: 'Lista de usuarios',
                            content: {
                                'application/json': {
                                    schema: {
                                        allOf: [
                                            { $ref: '#/components/schemas/ApiResponse' },
                                            { properties: { data: { type: 'array', items: { $ref: '#/components/schemas/UserRecord' } } } },
                                        ],
                                    },
                                },
                            },
                        },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '403': { description: 'Acceso denegado (RBAC)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
            '/users/{id}': {
                get: {
                    tags: ['Users'],
                    summary: 'Obtener usuario por ID',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'UID del usuario' }],
                    responses: {
                        '200': { description: 'Usuario encontrado', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/UserRecord' } } }] } } } },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '404': { description: 'No encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
                put: {
                    tags: ['Users'],
                    summary: 'Actualizar usuario',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'UID del usuario' }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateUserBody' } } },
                    },
                    responses: {
                        '200': { description: 'Usuario actualizado', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/UserRecord' } } }] } } } },
                        '400': { description: 'Datos inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
                delete: {
                    tags: ['Users'],
                    summary: 'Eliminar usuario',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'UID del usuario' }],
                    responses: {
                        '200': { description: 'Usuario eliminado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '404': { description: 'No encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
            '/storage/upload': {
                post: {
                    tags: ['Storage'],
                    summary: 'Subir archivo a Firebase Storage',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'multipart/form-data': {
                                schema: {
                                    type: 'object',
                                    required: ['file'],
                                    properties: {
                                        file: { type: 'string', format: 'binary', description: 'Archivo a subir' },
                                        folder: { type: 'string', example: 'songs', description: 'Carpeta destino (default: uploads)' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '201': { description: 'Archivo subido', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/UploadResponse' } } }] } } } },
                        '400': { description: 'Sin archivo', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
            '/storage/delete': {
                delete: {
                    tags: ['Storage'],
                    summary: 'Eliminar archivo de Firebase Storage',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/FilePathBody' } } },
                    },
                    responses: {
                        '200': { description: 'Archivo eliminado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
                        '400': { description: 'filePath requerido', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
            '/storage/signed-url': {
                post: {
                    tags: ['Storage'],
                    summary: 'Generar URL firmada temporal',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/SignedUrlBody' } } },
                    },
                    responses: {
                        '200': { description: 'URL firmada generada', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { type: 'object', properties: { url: { type: 'string' } } } } }] } } } },
                        '400': { description: 'filePath requerido', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
        },
    },
    apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
    app.use(
        '/api/docs',
        swaggerUi.serve,
        swaggerUi.setup(swaggerSpec, {
            customSiteTitle: '🎵 Q-Music API Docs',
            customCss: `
        .swagger-ui .topbar { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); }
        .swagger-ui .topbar-wrapper img { content: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23e94560'%3E%3Cpath d='M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z'/%3E%3C/svg%3E"); width: 32px; height: 32px; }
        .swagger-ui .info .title { color: #e94560; }
        .swagger-ui .scheme-container { background: #1a1a2e; }
      `,
            swaggerOptions: {
                persistAuthorization: true,
                docExpansion: 'list',
            },
        })
    );

    // Endpoint para obtener el JSON del spec
    app.get('/api/docs-json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });

    console.log('📚 Swagger UI disponible en: /api/docs');
}
