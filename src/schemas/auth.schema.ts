import { z } from 'zod';
import { UserRoleEnum } from '../enum/roles.enum';

const identityDocumentTypeSchema = z.enum(['cedula', 'ruc', 'pasaporte']);

const identificationNumberSchema = z
    .string()
    .trim()
    .transform((value) => value.toUpperCase().replace(/\s+/g, ''));

export const registerRequestSchema = z.object({
    body: z.object({
        email: z.string().email('Formato de email inválido').toLowerCase().trim(),
        password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
        displayName: z.string().min(2, 'El nombre es demasiado corto').trim(),
        role: z.nativeEnum(UserRoleEnum).default(UserRoleEnum.CLIENTE),
        identificationType: identityDocumentTypeSchema.optional(),
        identificationNumber: identificationNumberSchema.optional(),
    }).superRefine((body, ctx) => {
        const hasType = !!body.identificationType;
        const hasNumber = !!body.identificationNumber;

        if (hasType !== hasNumber) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['identificationType'],
                message: 'identificationType e identificationNumber deben enviarse juntos',
            });
            return;
        }

        if (!hasType || !hasNumber) return;
        const identificationNumber = body.identificationNumber as string;

        if (body.identificationType === 'cedula' && !/^\d{10}$/.test(identificationNumber)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['identificationNumber'],
                message: 'La cédula debe tener 10 dígitos',
            });
        }

        if (body.identificationType === 'ruc' && !/^\d{13}$/.test(identificationNumber)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['identificationNumber'],
                message: 'El RUC debe tener 13 dígitos',
            });
        }

        if (
            body.identificationType === 'pasaporte' &&
            !/^[A-Z0-9]{6,20}$/.test(identificationNumber)
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['identificationNumber'],
                message: 'El pasaporte debe tener entre 6 y 20 caracteres alfanuméricos',
            });
        }
    }),
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
