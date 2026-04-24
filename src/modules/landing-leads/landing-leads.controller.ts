import { Request, Response } from 'express';
import { LandingLeadsService, validateLandingLeadBody } from './landing-leads.service';
import { sendCreated, sendError } from '../../utils/response.util';

const service = new LandingLeadsService();

function clientIp(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0]?.trim();
    }
    if (Array.isArray(forwarded) && forwarded[0]) {
        return forwarded[0].split(',')[0]?.trim();
    }
    return req.ip;
}

function userAgent(req: Request): string | undefined {
    const ua = req.headers['user-agent'];
    if (typeof ua !== 'string' || !ua.trim()) return undefined;
    return ua.trim().slice(0, 512);
}

export class LandingLeadsController {
    async create(req: Request, res: Response): Promise<void> {
        const parsed = validateLandingLeadBody(req.body);
        if (!parsed.ok) {
            sendError({ res, error: parsed.error, statusCode: 400 });
            return;
        }

        try {
            const result = await service.createLead({
                ...parsed.value,
                clientIp: clientIp(req),
                userAgent: userAgent(req),
            });
            sendCreated(res, result, 'Solicitud registrada');
        } catch (e) {
            console.error('[landing-leads] create', e);
            sendError({ res, error: 'No se pudo guardar la solicitud', statusCode: 500 });
        }
    }
}
