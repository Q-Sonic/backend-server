import { Response } from 'express';
import { EventsService } from './events.service';
import { AuthRequest, ApiResponse } from '../../types';
import { UserRoleEnum } from '../../enum/roles.enum';

const eventsService = new EventsService();

export class EventsController {
    async getCalendar(req: AuthRequest, res: Response): Promise<void> {
        const uid = req.user?.uid;
        if (!uid) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }

        const { start, end } = req.query;
        const startDate = start ? new Date(String(start)) : undefined;
        const endDate = end ? new Date(String(end)) : undefined;

        try {
            const role = req.user?.role;
            let events;
            if (role === UserRoleEnum.ARTISTA) {
                events = await eventsService.getCalendarEvents(uid, startDate, endDate);
            } else {
                events = await eventsService.getClientCalendarEvents(uid, startDate, endDate);
            }
            res.status(200).json({ success: true, data: events } as ApiResponse);
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message } as ApiResponse);
        }
    }

    async getDetail(req: AuthRequest, res: Response): Promise<void> {
        const uid = req.user?.uid;
        if (!uid) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }

        const { id } = req.params;

        try {
            const role = req.user?.role;
            const detail = await eventsService.getExtendedEventDetail(id as string, uid as string);
            
            // If the user is a client, we should ensure they own this contract
            // However, getExtendedEventDetail currently checks "artistId === uid".
            // I need to update the service to handle both.
            
            res.status(200).json({ success: true, data: detail } as ApiResponse);
        } catch (error: any) {
            const statusCode = error.message.includes('Unauthorized') ? 403 : 404;
            res.status(statusCode).json({ success: false, error: error.message } as ApiResponse);
        }
    }
}
