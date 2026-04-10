import { Response } from 'express';
import { AuthRequest } from '../../types';
import { ContractsService } from './contracts.service';
import { sendSuccess, sendError } from '../../utils/response.util';

const contractsService = new ContractsService();

export class ContractsController {
    async getMyHistory(req: AuthRequest, res: Response) {
        if (!req.user) return sendError({ res, error: 'Unauthorized', statusCode: 401 });

        const { skip, take, filterField, filterValue } = req.query;
        const history = await contractsService.findClientHistory(req.user.uid, {
            skip: skip ? Number(skip) : 0,
            take: take ? Number(take) : 20,
            filterField: filterField ? String(filterField) : undefined,
            filterValue: filterValue ? String(filterValue) : undefined,
        });
        sendSuccess(res, history, 'Contracts history retrieved');
    }

    async getArtistHistory(req: AuthRequest, res: Response) {
        if (!req.user) return sendError({ res, error: 'Unauthorized', statusCode: 401 });

        const { skip, take, filterField, filterValue } = req.query;
        const history = await contractsService.findArtistHistory(req.user.uid, {
            skip: skip ? Number(skip) : 0,
            take: take ? Number(take) : 20,
            filterField: filterField ? String(filterField) : undefined,
            filterValue: filterValue ? String(filterValue) : undefined,
        });
        sendSuccess(res, history, 'Artist contracts history retrieved');
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

        try {
            const contract = await contractsService.createContract(req.user.uid, req.body);
            sendSuccess(res, contract, 'Contract created successfully', 201);
        } catch (error: any) {
            sendError({ res, error: error.message, statusCode: 500 });
        }
    }

    async updateStatus(req: AuthRequest, res: Response) {
        if (!req.user) return sendError({ res, error: 'Unauthorized', statusCode: 401 });

        const { id } = req.params;
        const { status } = req.body;

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

        try {
            const contract = await contractsService.addPayment(id as string, req.user.uid, req.body);
            sendSuccess(res, contract, 'Payment registered successfully');
        } catch (error: any) {
            sendError({ res, error: error.message, statusCode: 403 });
        }
    }
}
