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
                        emailVerified: { type: 'boolean', example: false },
                        createdAt: { type: 'string', example: '2026-01-01T00:00:00Z' },
                        updatedAt: { type: 'string', example: '2026-01-01T00:00:00Z' },
                    },
                },
                // ... Keep all other schemas here as they are shared models
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
                ArtistSongRecord: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: 'songId123' },
                        artistId: { type: 'string', example: 'abc123uid' },
                        title: { type: 'string', example: 'My Awesome Song' },
                        audioUrl: { type: 'string', example: 'https://storage...' },
                        coverUrl: { type: 'string', example: 'https://storage...' },
                        isFeatured: { type: 'boolean', example: false },
                    },
                },
                ArtistProfileRecord: {
                    type: 'object',
                    properties: {
                        uid: { type: 'string' },
                        biography: { type: 'string' },
                        photo: { type: 'string' },
                        city: { type: 'string' },
                        genre: { type: 'string', example: 'Pop' },
                        minPrice: { type: 'number', example: 500 },
                        technicalRiderUrl: { type: 'string' },
                        blockedDates: { type: 'array', items: { type: 'string' } },
                        featuredSong: { type: 'object' },
                        media: { type: 'array', items: { $ref: '#/components/schemas/ArtistProfileMediaItem' } },
                    },
                },
                ArtistProfileMediaItem: {
                    type: 'object',
                    required: ['url', 'type'],
                    properties: {
                        url: { type: 'string', example: 'https://storage...' },
                        type: { type: 'string', enum: ['image', 'audio', 'video'], example: 'image' },
                        name: { type: 'string', example: 'concert_photo.jpg' },
                        category: { type: 'string', example: 'Backstage' },
                    },
                },
                ArtistAvailability: {
                    type: 'object',
                    properties: {
                        blocked: { type: 'array', items: { type: 'string' } },
                        reserved: { type: 'array', items: { type: 'string' } },
                        pending: { type: 'array', items: { type: 'string' } },
                    },
                },
                DashboardStats: {
                    type: 'object',
                    properties: {
                        totalEvents: { type: 'number', example: 12 },
                        eventsGrowthPercent: { type: 'number', example: 15.5 },
                        totalBalance: { type: 'number', example: 450000 },
                        profileVisitsTotal: { type: 'number', example: 1240 },
                        visitsChartData: { 
                            type: 'array', 
                            items: { 
                                type: 'object',
                                properties: {
                                    day: { type: 'string', example: '2026-03-31' },
                                    count: { type: 'number', example: 45 }
                                }
                            } 
                        },
                        nextEvent: { $ref: '#/components/schemas/ContractRecord' }
                    },
                },
                ContractRecord: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED'] },
                        eventDetails: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                date: { type: 'object', description: 'Firestore Timestamp' },
                                location: { type: 'string' },
                                description: { type: 'string' }
                            }
                        },
                        financials: {
                            type: 'object',
                            properties: {
                                totalAmount: { type: 'number' },
                                paidAmount: { type: 'number' },
                                paymentStatus: { type: 'string', enum: ['UNPAID', 'PARTIAL', 'PAID'] }
                            }
                        },
                        contractUrl: { type: 'string' },
                        riderUrl: { type: 'string' }
                    },
                },
                CreateContractBody: {
                    type: 'object',
                    required: ['artistId', 'serviceId', 'eventDetails', 'totalAmount'],
                    properties: {
                        artistId: { type: 'string' },
                        serviceId: { type: 'string' },
                        totalAmount: { type: 'number' },
                        eventDetails: {
                            type: 'object',
                            required: ['name', 'date', 'location'],
                            properties: {
                                name: { type: 'string', example: 'Fiesta de Cumpleaños' },
                                date: { type: 'string', format: 'date-time', example: '2026-12-31T20:00:00Z' },
                                location: { type: 'string', example: 'Buenos Aires, AR' },
                                description: { type: 'string', example: 'Evento privado' }
                            }
                        }
                    }
                },
            },
        },
        tags: [
            { name: 'Health', description: 'Estado del servidor' },
            { name: 'Auth', description: 'Registro y perfil de usuario' },
            { name: 'Artist Profile', description: 'Perfil público del artista (US-10)' },
            { name: 'Dashboard', description: 'Estadísticas y balance del artista' },
            { name: 'Events', description: 'Gestión de calendario y shows' },
            { name: 'Contracts', description: 'Gestión de contratos y pagos' },
        ],
        paths: {}, // Modularized paths are scanned from files
    },
    apis: ['./src/app.ts', './src/modules/**/*.routes.ts'],
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
        .swagger-ui .info .title { color: #e94560; }
        .swagger-ui .scheme-container { background: #1a1a2e; }
      `,
            swaggerOptions: {
                persistAuthorization: true,
                docExpansion: 'list',
            },
        })
    );

    app.get('/api/docs-json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });

    console.log('📚 Swagger UI disponible en: /api/docs');
}
