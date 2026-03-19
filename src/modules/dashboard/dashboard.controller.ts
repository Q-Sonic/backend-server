import { Request, Response } from 'express';
import { DashboardService } from './dashboard.service';
import { AuthRequest, ApiResponse, DashboardStats } from '../../types';
import { UserRoleEnum } from '../../enum/roles.enum';

const dashboardService = new DashboardService();

export class DashboardController {
    async getSummary(req: AuthRequest, res: Response): Promise<void> {
        const uid = req.user?.uid;
        const role = req.user?.role;

        if (!uid || role !== UserRoleEnum.ARTISTA) {
            res.status(403).json({ success: false, error: 'Access denied: Artist only' } as ApiResponse);
            return;
        }

        try {
            const stats = await dashboardService.getStats(uid);
            res.status(200).json({
                success: true,
                data: stats
            } as ApiResponse<DashboardStats>);
        } catch (error: any) {
            console.error('Error fetching dashboard summary:', error);
            res.status(500).json({ success: false, error: error.message } as ApiResponse);
        }
    }
}
