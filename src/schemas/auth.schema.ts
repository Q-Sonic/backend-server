import { z } from 'zod';
import { UserRoleEnum } from '../enum/roles.enum';

export const registerRequestSchema = z.object({
    body: z.object({
        email: z.string({ required_error: 'El email es obligatorio' })
            .email('Formato de email inválido')
            .toLowerCase()
            .trim(),
        password: z.string({ required_error: 'La contraseña es obligatoria' })
            .min(8, 'La contraseña debe tener al menos 8 caracteres'),
        displayName: z.string({ required_error: 'El nombre es obligatorio' })
            .min(2, 'El nombre es demasiado corto')
            .trim(),
        role: z.nativeEnum(UserRoleEnum, { 
            errorMap: () => ({ message: 'Rol inválido' }) 
        }).default(UserRoleEnum.CLIENTE)
    })
});

export const loginRequestSchema = z.object({
    body: z.object({
        email: z.string({ required_error: 'El email es obligatorio' })
            .email('Formato de email inválido')
            .toLowerCase()
            .trim(),
        password: z.string({ required_error: 'La contraseña es obligatoria' })
    })
});

export const createArtistRequestSchema = z.object({
    body: z.object({
        email: z.string({ required_error: 'El email es obligatorio' })
            .email('Formato de email inválido')
            .toLowerCase()
            .trim(),
        password: z.string({ required_error: 'La contraseña es obligatoria' })
            .min(8, 'La contraseña debe tener al menos 8 caracteres'),
        displayName: z.string({ required_error: 'El nombre de artista es obligatorio' })
            .min(2, 'El nombre es demasiado corto')
            .trim(),
    })
});

export type RegisterSchema = z.infer<typeof registerSchema>;
export type LoginSchema = z.infer<typeof loginSchema>;
export type CreateArtistSchema = z.infer<typeof createArtistSchema>;
