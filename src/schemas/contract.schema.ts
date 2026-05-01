import { z } from 'zod';

export const createContractRequestSchema = z.object({
    body: z.object({
        artistId: z.string().min(1, 'El ID del artista es obligatorio'),
        serviceId: z.string().min(1, 'El ID del servicio es obligatorio'),
        totalAmount: z.number().positive('El monto debe ser mayor a cero'),
        eventDetails: z.object({
            name: z.string().min(3, 'El nombre del evento es muy corto'),
            date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Formato de fecha inválido' }),
            location: z.string().min(1, 'La ubicación es obligatoria'),
            description: z.string().optional(),
        }),
        clientSignatureDataUrl: z.string().optional(),
        acceptedTerms: z.boolean().optional()
    })
});

export const updateContractStatusRequestSchema = z.object({
    body: z.object({
        status: z.string().min(1, 'El estado es obligatorio'),
        reason: z.string().optional()
    })
});

export const addPaymentRequestSchema = z.object({
    body: z.object({
        amount: z.number().positive('El monto debe ser mayor a cero'),
        method: z.string().optional().default('cash'),
        reference: z.string().optional(),
    })
});

export type CreateContractSchema = z.infer<typeof createContractRequestSchema>;
export type UpdateContractStatusSchema = z.infer<typeof updateContractStatusRequestSchema>;
export type AddPaymentSchema = z.infer<typeof addPaymentRequestSchema>;
