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
                DeleteStorageBody: {
                    type: 'object',
                    description: 'Pass the file URL (recommended) or the path in the bucket',
                    properties: {
                        url: { type: 'string', example: 'https://storage.googleapis.com/your-bucket/client_profiles/uid/photo_123.jpg', description: 'Full Storage URL to delete' },
                        filePath: { type: 'string', example: 'uploads/1234_song.mp3', description: 'Path in bucket (alternative)' },
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
                ArtistServiceRecord: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: 'docId123' },
                        artistId: { type: 'string', example: 'artistUid' },
                        name: { type: 'string', example: 'Concierto' },
                        price: { type: 'number', example: 500 },
                        description: { type: 'string', example: 'Show en vivo con banda completa' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
                CreateArtistServiceBody: {
                    type: 'object',
                    required: ['name', 'price'],
                    properties: {
                        name: { type: 'string', example: 'Concierto' },
                        price: { type: 'number', example: 500 },
                        description: { type: 'string', example: 'Show en vivo con banda completa' },
                    },
                },
                UpdateArtistServiceBody: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', example: 'Concierto' },
                        price: { type: 'number', example: 600 },
                        description: { type: 'string', example: 'Show en vivo' },
                    },
                },
                ClientProfileRecord: {
                    type: 'object',
                    properties: {
                        uid: { type: 'string' },
                        name: { type: 'string', example: 'Juan Pérez' },
                        phone: { type: 'string', example: '+34 600 000 000' },
                        location: { type: 'string', example: 'Madrid, España' },
                        photo: { type: 'string', example: 'https://...' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
                CreateOrUpdateClientProfileBody: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        phone: { type: 'string' },
                        location: { type: 'string' },
                        photo: { type: 'string' },
                    },
                },
                SocialNetworks: {
                    type: 'object',
                    properties: {
                        instagram: { type: 'string' },
                        facebook: { type: 'string' },
                        twitter: { type: 'string' },
                        youtube: { type: 'string' },
                        tiktok: { type: 'string' },
                    },
                },
                ArtistProfileRecord: {
                    type: 'object',
                    properties: {
                        uid: { type: 'string' },
                        biography: { type: 'string' },
                        socialNetworks: { $ref: '#/components/schemas/SocialNetworks' },
                        photo: { type: 'string' },
                        city: { type: 'string', example: 'Barcelona' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
                CreateOrUpdateArtistProfileBody: {
                    type: 'object',
                    properties: {
                        biography: { type: 'string' },
                        socialNetworks: { $ref: '#/components/schemas/SocialNetworks' },
                        photo: { type: 'string' },
                        city: { type: 'string' },
                    },
                },
                EventDetails: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', example: 'Boda de Juan y Ana' },
                        date: { type: 'string', format: 'date-time', description: 'Fecha del evento' },
                        location: { type: 'string', example: 'Hacienda El Retiro, Madrid' },
                        description: { type: 'string', example: 'Evento privado, traer equipo de sonido' },
                    },
                },
                PaymentItem: {
                    type: 'object',
                    properties: {
                        amount: { type: 'number', example: 250 },
                        date: { type: 'string', format: 'date-time' },
                        reference: { type: 'string', example: 'Transferencia 12345' },
                        method: { type: 'string', example: 'transfer' },
                    },
                },
                ContractFinancials: {
                    type: 'object',
                    properties: {
                        totalAmount: { type: 'number', example: 500 },
                        paidAmount: { type: 'number', example: 250 },
                        paymentStatus: { type: 'string', enum: ['unpaid', 'partial', 'paid'], example: 'partial' },
                    },
                },
                ContractRecord: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        clientId: { type: 'string' },
                        artistId: { type: 'string' },
                        serviceId: { type: 'string' },
                        status: { type: 'string', enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'], example: 'pending' },
                        eventDetails: { $ref: '#/components/schemas/EventDetails' },
                        financials: { $ref: '#/components/schemas/ContractFinancials' },
                        payments: { type: 'array', items: { $ref: '#/components/schemas/PaymentItem' } },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
                CreateContractBody: {
                    type: 'object',
                    required: ['artistId', 'serviceId', 'eventDetails', 'totalAmount'],
                    properties: {
                        artistId: { type: 'string', example: 'artist_uid_123' },
                        serviceId: { type: 'string', example: 'service_id_456' },
                        eventDetails: {
                            type: 'object',
                            required: ['name', 'date', 'location'],
                            properties: {
                                name: { type: 'string', example: 'Concierto Aniversario' },
                                date: { type: 'string', format: 'date', example: '2026-06-15' },
                                location: { type: 'string', example: 'Teatro Principal' },
                                description: { type: 'string' },
                            },
                        },
                        totalAmount: { type: 'number', example: 1000 },
                    },
                },
                UpdateContractStatusBody: {
                    type: 'object',
                    required: ['status'],
                    properties: {
                        status: { type: 'string', enum: ['accepted', 'rejected', 'completed', 'cancelled'], example: 'accepted' },
                    },
                },
                AddPaymentBody: {
                    type: 'object',
                    required: ['amount'],
                    properties: {
                        amount: { type: 'number', example: 500 },
                        reference: { type: 'string', example: 'Pago en efectivo' },
                        method: { type: 'string', example: 'cash' },
                    },
                },
            },
        },
        tags: [
            { name: 'Health', description: 'Estado del servidor' },
            { name: 'Auth', description: 'Registro y perfil de usuario' },
            { name: 'Users', description: 'CRUD de usuarios (requiere auth)' },
            { name: 'Storage', description: 'Gestión de archivos en Firebase Storage' },
            { name: 'Artist Services', description: 'CRUD de servicios/precios del artista (concierto, acústico, evento privado)' },
            { name: 'Client Profile', description: 'Perfil de cliente (US-6, US-7)' },
            { name: 'Artist Profile', description: 'Perfil público del artista (US-10)' },
            { name: 'Contracts', description: 'Gestión de contratos, eventos y pagos (US-8, US-5)' },
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
                    summary: 'Eliminar archivo por URL o path',
                    description: 'Envía la URL del archivo en Storage (recomendado) o el filePath. La URL debe ser del bucket del proyecto.',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/DeleteStorageBody' } } },
                    },
                    responses: {
                        '200': { description: 'Archivo eliminado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
                        '400': { description: 'url o filePath requerido; o URL inválida/externa', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
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
            '/artist-services': {
                get: {
                    tags: ['Artist Services'],
                    summary: 'Listar servicios del artista autenticado',
                    description: 'Solo rol artista. Devuelve concierto, acústico, evento privado, etc.',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        '200': {
                            description: 'Lista de servicios del artista',
                            content: {
                                'application/json': {
                                    schema: {
                                        allOf: [
                                            { $ref: '#/components/schemas/ApiResponse' },
                                            { properties: { data: { type: 'array', items: { $ref: '#/components/schemas/ArtistServiceRecord' } } } },
                                        ],
                                    },
                                },
                            },
                        },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '403': { description: 'Solo artistas', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
                post: {
                    tags: ['Artist Services'],
                    summary: 'Crear servicio (concierto, acústico, evento privado)',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateArtistServiceBody' } } },
                    },
                    responses: {
                        '201': {
                            description: 'Servicio creado',
                            content: {
                                'application/json': {
                                    schema: {
                                        allOf: [
                                            { $ref: '#/components/schemas/ApiResponse' },
                                            { properties: { data: { $ref: '#/components/schemas/ArtistServiceRecord' } } },
                                        ],
                                    },
                                },
                            },
                        },
                        '400': { description: 'name y price requeridos', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '403': { description: 'Solo artistas', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
            '/artist-services/all/{artistId}': {
                get: {
                    tags: ['Artist Services'],
                    summary: 'Listar todos los servicios de un artista',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'artistId', in: 'path', required: true, schema: { type: 'string' }, description: 'ID del artista' }],
                    responses: {
                        '200': { description: 'Lista de servicios del artista', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
                    },
                },
            },
            '/artist-services/{id}': {
                get: {
                    tags: ['Artist Services'],
                    summary: 'Obtener un servicio por ID',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID del servicio' }],
                    responses: {
                        '200': {
                            description: 'Servicio encontrado',
                            content: {
                                'application/json': {
                                    schema: {
                                        allOf: [
                                            { $ref: '#/components/schemas/ApiResponse' },
                                            { properties: { data: { $ref: '#/components/schemas/ArtistServiceRecord' } } },
                                        ],
                                    },
                                },
                            },
                        },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '403': { description: 'Solo artistas', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '404': { description: 'Servicio no encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
                put: {
                    tags: ['Artist Services'],
                    summary: 'Actualizar servicio',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID del servicio' }],
                    requestBody: {
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateArtistServiceBody' } } },
                    },
                    responses: {
                        '200': {
                            description: 'Servicio actualizado',
                            content: {
                                'application/json': {
                                    schema: {
                                        allOf: [
                                            { $ref: '#/components/schemas/ApiResponse' },
                                            { properties: { data: { $ref: '#/components/schemas/ArtistServiceRecord' } } },
                                        ],
                                    },
                                },
                            },
                        },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '403': { description: 'Solo artistas', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '404': { description: 'Servicio no encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
                delete: {
                    tags: ['Artist Services'],
                    summary: 'Eliminar servicio',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID del servicio' }],
                    responses: {
                        '200': { description: 'Servicio eliminado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '403': { description: 'Solo artistas', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '404': { description: 'Servicio no encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
            '/client-profiles/me': {
                get: {
                    tags: ['Client Profile'],
                    summary: 'Obtener mi perfil de cliente',
                    description: 'Solo rol cliente.',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        '200': {
                            description: 'Perfil del cliente',
                            content: {
                                'application/json': {
                                    schema: {
                                        allOf: [
                                            { $ref: '#/components/schemas/ApiResponse' },
                                            { properties: { data: { $ref: '#/components/schemas/ClientProfileRecord' } } },
                                        ],
                                    },
                                },
                            },
                        },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '403': { description: 'Solo clientes', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '404': { description: 'Perfil no encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
            '/client-profiles/{id}': {
                get: {
                    tags: ['Client Profile'],
                    summary: 'Obtener perfil de cliente por ID',
                    description: 'Solo roles admin y soporte.',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'UID del cliente' }],
                    responses: {
                        '200': {
                            description: 'Perfil del cliente',
                            content: {
                                'application/json': {
                                    schema: {
                                        allOf: [
                                            { $ref: '#/components/schemas/ApiResponse' },
                                            { properties: { data: { $ref: '#/components/schemas/ClientProfileRecord' } } },
                                        ],
                                    },
                                },
                            },
                        },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '403': { description: 'Solo admin/soporte', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '404': { description: 'Perfil no encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
            '/client-profiles': {
                put: {
                    tags: ['Client Profile'],
                    summary: 'Crear o actualizar perfil del cliente',
                    description: 'Solo cliente. Acepta JSON o multipart/form-data con campo "photo" (archivo imagen); la imagen se sube a Firebase Storage.',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: {
                            'application/json': { schema: { $ref: '#/components/schemas/CreateOrUpdateClientProfileBody' } },
                            'multipart/form-data': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        photo: { type: 'string', format: 'binary', description: 'Imagen (jpeg, png, webp, gif)' },
                                        name: { type: 'string' },
                                        phone: { type: 'string' },
                                        location: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '200': {
                            description: 'Perfil guardado',
                            content: {
                                'application/json': {
                                    schema: {
                                        allOf: [
                                            { $ref: '#/components/schemas/ApiResponse' },
                                            { properties: { data: { $ref: '#/components/schemas/ClientProfileRecord' } } },
                                        ],
                                    },
                                },
                            },
                        },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '403': { description: 'Solo clientes', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
            '/artist-profiles/me': {
                get: {
                    tags: ['Artist Profile'],
                    summary: 'Obtener mi perfil de artista',
                    description: 'Solo rol artista.',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        '200': {
                            description: 'Perfil del artista',
                            content: {
                                'application/json': {
                                    schema: {
                                        allOf: [
                                            { $ref: '#/components/schemas/ApiResponse' },
                                            { properties: { data: { $ref: '#/components/schemas/ArtistProfileRecord' } } },
                                        ],
                                    },
                                },
                            },
                        },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '403': { description: 'Solo artistas', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '404': { description: 'Perfil no encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
            '/artist-profiles/{id}': {
                get: {
                    tags: ['Artist Profile'],
                    summary: 'Obtener perfil de artista por ID',
                    description: 'Cliente, admin y soporte: cualquier artista. Artista: solo el propio (id = uid).',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'UID del artista' }],
                    responses: {
                        '200': {
                            description: 'Perfil del artista',
                            content: {
                                'application/json': {
                                    schema: {
                                        allOf: [
                                            { $ref: '#/components/schemas/ApiResponse' },
                                            { properties: { data: { $ref: '#/components/schemas/ArtistProfileRecord' } } },
                                        ],
                                    },
                                },
                            },
                        },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '403': { description: 'Sin permiso', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '404': { description: 'Perfil no encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
            '/artist-profiles': {
                put: {
                    tags: ['Artist Profile'],
                    summary: 'Crear o actualizar perfil del artista',
                    description: 'Solo artista. Acepta JSON o multipart/form-data con campo "photo" (archivo imagen); la imagen se sube a Firebase Storage.',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: {
                            'application/json': { schema: { $ref: '#/components/schemas/CreateOrUpdateArtistProfileBody' } },
                            'multipart/form-data': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        photo: { type: 'string', format: 'binary', description: 'Imagen (jpeg, png, webp, gif)' },
                                        biography: { type: 'string' },
                                        city: { type: 'string' },
                                        instagram: { type: 'string' },
                                        facebook: { type: 'string' },
                                        twitter: { type: 'string' },
                                        youtube: { type: 'string' },
                                        tiktok: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '200': {
                            description: 'Perfil guardado',
                            content: {
                                'application/json': {
                                    schema: {
                                        allOf: [
                                            { $ref: '#/components/schemas/ApiResponse' },
                                            { properties: { data: { $ref: '#/components/schemas/ArtistProfileRecord' } } },
                                        ],
                                    },
                                },
                            },
                        },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '403': { description: 'Solo artistas', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
            '/contracts/my-history': {
                get: {
                    tags: ['Contracts'],
                    summary: 'Listar historial de contratos y eventos del cliente',
                    description: 'Solo rol cliente. Retorna todos los contratos donde el usuario es el cliente.',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        '200': {
                            description: 'Historial de contratos',
                            content: {
                                'application/json': {
                                    schema: {
                                        allOf: [
                                            { $ref: '#/components/schemas/ApiResponse' },
                                            { properties: { data: { type: 'array', items: { $ref: '#/components/schemas/ContractRecord' } } } },
                                        ],
                                    },
                                },
                            },
                        },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '403': { description: 'Solo clientes', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
            '/contracts': {
                post: {
                    tags: ['Contracts'],
                    summary: 'Crear un nuevo contrato/reserva',
                    description: 'Solo rol cliente. Inicia un contrato en estado "pending".',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateContractBody' } } },
                    },
                    responses: {
                        '201': {
                            description: 'Contrato creado',
                            content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/ContractRecord' } } }] } } },
                        },
                        '400': { description: 'Faltan campos requeridos', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '401': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
            '/contracts/{id}': {
                get: {
                    tags: ['Contracts'],
                    summary: 'Obtener detalle de un contrato específico',
                    description: 'Solo accesible por el cliente o el artista involucrados.',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID del contrato' }],
                    responses: {
                        '200': { description: 'Contrato encontrado', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/ContractRecord' } } }] } } } },
                        '403': { description: 'Acceso denegado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '404': { description: 'No encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
            '/contracts/{id}/status': {
                patch: {
                    tags: ['Contracts'],
                    summary: 'Actualizar estado del contrato',
                    description: 'Artista puede aceptar/rechazar/completar. Cliente puede cancelar.',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID del contrato' }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateContractStatusBody' } } },
                    },
                    responses: {
                        '200': { description: 'Estado actualizado', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/ContractRecord' } } }] } } } },
                        '400': { description: 'Status requerido', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                        '403': { description: 'No autorizado para este cambio', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
                    },
                },
            },
            '/contracts/{id}/payments': {
                post: {
                    tags: ['Contracts'],
                    summary: 'Registrar un pago para el contrato',
                    description: 'Solo el artista o admin puede registrar pagos recibidos.',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID del contrato' }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/AddPaymentBody' } } },
                    },
                    responses: {
                        '200': { description: 'Pago registrado', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiResponse' }, { properties: { data: { $ref: '#/components/schemas/ContractRecord' } } }] } } } },
                        '403': { description: 'No autorizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
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
