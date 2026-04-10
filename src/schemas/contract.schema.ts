import { z } from 'zod';

export const createContractRequestSchema = z.object({
    body: z.object({
        artistId: z.string({ required_error: 'El ID del artista es obligatorio' }),
        serviceId: z.string({ required_error: 'El ID del servicio es obligatorio' }),
        totalAmount: z.number({ required_error: 'El monto total es obligatorio' })
            .positive('El monto debe ser mayor a cero'),
        eventDetails: z.object({
            name: z.string({ required_error: 'El nombre del evento es obligatorio' })
                .min(3, 'El nombre del evento es muy corto'),
            date: z.string({ required_error: 'La fecha del evento es obligatoria' })
                .refine((val) => !isNaN(Date.parse(val)), { message: 'Formato de fecha inválido' }),
            location: z.string({ required_error: 'La ubicación es obligatoria' }),
            description: z.string().optional(),
        })
    })
});

export const updateContractStatusRequestSchema = z.object({
    body: z.object({
        status: z.string({ required_error: 'El estado es obligatorio' })
    })
});

export const addPaymentRequestSchema = z.object({
    body: z.object({
        amount: z.number({ required_error: 'El monto es obligatorio' })
            .positive('El monto debe ser mayor a cero'),
        method: z.string().optional().default('cash'),
        reference: z.string().optional(),
    })
});
