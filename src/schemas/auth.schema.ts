import { z } from 'zod';
import { UserRoleEnum } from '../enum/roles.enum';

export const registerRequestSchema = z.object({
    body: z.object({
        email: z.string().email('Formato de email inválido').toLowerCase().trim(),
        password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
        displayName: z.string().min(2, 'El nombre es demasiado corto').trim(),
        role: z.nativeEnum(UserRoleEnum).default(UserRoleEnum.CLIENTE)
    })
});

export const loginRequestSchema = z.object({
    body: z.object({
        email: z.string().email('Formato de email inválido').toLowerCase().trim(),
        password: z.string().min(1, 'La contraseña es obligatoria')
    })
});

export const createArtistRequestSchema = z.object({
    body: z.object({
        email: z.string().email('Formato de email inválido').toLowerCase().trim(),
        password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
        displayName: z.string().min(2, 'El nombre es demasiado corto').trim(),
    })
});

export type RegisterSchema = z.infer<typeof registerRequestSchema>;
export type LoginSchema = z.infer<typeof loginRequestSchema>;
export type CreateArtistSchema = z.infer<typeof createArtistRequestSchema>;
