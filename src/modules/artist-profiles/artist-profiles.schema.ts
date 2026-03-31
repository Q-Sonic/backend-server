import { z } from 'zod';

export const artistProfileSchema = z.object({
    body: z.object({
        biography: z.string().max(5000, 'La biografía no puede exceder 5000 caracteres').optional(),
        genre: z.string().max(50).optional(),
        city: z.string().max(100).optional(),
        socialNetworks: z.object({
            instagram: z.string().url('URL de Instagram inválida').or(z.literal('')).optional(),
            facebook: z.string().url('URL de Facebook inválida').or(z.literal('')).optional(),
            twitter: z.string().url('URL de Twitter inválida').or(z.literal('')).optional(),
            youtube: z.string().url('URL de Youtube inválida').or(z.literal('')).optional(),
            tiktok: z.string().url('URL de TikTok inválida').or(z.literal('')).optional(),
        }).optional(),
        instagram: z.string().url('URL de Instagram inválida').or(z.literal('')).optional(),
        facebook: z.string().url('URL de Facebook inválida').or(z.literal('')).optional(),
        twitter: z.string().url('URL de Twitter inválida').or(z.literal('')).optional(),
        youtube: z.string().url('URL de Youtube inválida').or(z.literal('')).optional(),
        tiktok: z.string().url('URL de TikTok inválida').or(z.literal('')).optional(),
        blockedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')).optional(),
        featuredSong: z.object({
            title: z.string().min(1, 'Título requerido'),
            artistName: z.string().min(1, 'Nombre de artista requerido'),
            streamUrl: z.string().url('URL de streaming inválida'),
            coverUrl: z.string().url('URL de carátula inválida').optional(),
        }).optional(),
        media: z.array(z.object({
            url: z.string().url('URL de media inválida'),
            type: z.enum(['image', 'audio', 'video']),
            name: z.string().optional(),
            category: z.string().max(50).optional(),
        })).optional(),
    }),
});
