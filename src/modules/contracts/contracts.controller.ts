import { Response } from 'express';
import { AuthRequest } from '../../types';
import { ContractsService } from './contracts.service';
import { sendSuccess, sendError } from '../../utils/response.util';

const contractsService = new ContractsService();

export class ContractsController {
    async getMyHistory(req: AuthRequest, res: Response) {
        if (!req.user) return sendError({ res, error: 'Unauthorized', statusCode: 401 });

        const history = await contractsService.findClientHistory(req.user.uid);
        sendSuccess(res, history, 'Contracts history retrieved');
    }

    async getById(req: AuthRequest, res: Response) {
        if (!req.user) return sendError({ res, error: 'Unauthorized', statusCode: 401 });

        try {
            const { id } = req.params;
            const contract = await contractsService.findById(id as string, req.user.uid);
            sendSuccess(res, contract);
        } catch (error: any) {
            sendError({ res, error: error.message, statusCode: 403 });
        }
    }

    async create(req: AuthRequest, res: Response) {
        if (!req.user) return sendError({ res, error: 'Unauthorized', statusCode: 401 });

        // Simple validation
        const { artistId, serviceId, eventDetails, totalAmount } = req.body;
        if (!artistId || !serviceId || !eventDetails || !totalAmount) {
            return sendError({ res, error: 'Missing required fields', statusCode: 400 });
        }

        try {
            const contract = await contractsService.create(req.user.uid, req.body);
            sendSuccess(res, contract, 'Contract created successfully', 201);
        } catch (error: any) {
            sendError({ res, error: error.message, statusCode: 500 });
        }
    }

    async updateStatus(req: AuthRequest, res: Response) {
        if (!req.user) return sendError({ res, error: 'Unauthorized', statusCode: 401 });

        const { id } = req.params;
        const { status } = req.body;

        if (!status) return sendError({ res, error: 'Status is required', statusCode: 400 });

        try {
            const contract = await contractsService.updateStatus(id as string, req.user.uid, status);
            sendSuccess(res, contract, `Contract status updated to ${status}`);
        } catch (error: any) {
            sendError({ res, error: error.message, statusCode: 403 });
        }
    }

    async addPayment(req: AuthRequest, res: Response) {
        if (!req.user) return sendError({ res, error: 'Unauthorized', statusCode: 401 });

        const { id } = req.params;
        const { amount } = req.body;

        if (!amount) return sendError({ res, error: 'Amount is required', statusCode: 400 });

        try {
            const contract = await contractsService.addPayment(id as string, req.user.uid, req.body);
            sendSuccess(res, contract, 'Payment registered successfully');
        } catch (error: any) {
            sendError({ res, error: error.message, statusCode: 403 });
        }
    }
}
