import { Response } from 'express';
import { AuthRequest } from '../../types';
import { ContractsService } from './contracts.service';
import { sendSuccess, sendError } from '../../utils/response.util';

/**
 * Contracts Controller
 * Handles HTTP requests for contract lifecycle.
 */
export class ContractsController {
    /**
     * GET /api/contracts/my-history
     */
    static async getMyHistory(req: AuthRequest, res: Response): Promise<Response> {
        if (!req.user) return sendError({ res, error: 'Unauthorized', statusCode: 401 });

        const { skip, take, filterField, filterValue } = req.query;
        const history = await ContractsService.findClientHistory(req.user.uid, {
            skip: skip ? Number(skip) : 0,
            take: take ? Number(take) : 20,
            filterField: filterField ? String(filterField) : undefined,
            filterValue: filterValue ? String(filterValue) : undefined,
        });
        return sendSuccess(res, history, 'Contracts history retrieved');
    }

    /**
     * GET /api/contracts/artist-history
     */
    static async getArtistHistory(req: AuthRequest, res: Response): Promise<Response> {
        if (!req.user) return sendError({ res, error: 'Unauthorized', statusCode: 401 });

        const { skip, take, filterField, filterValue } = req.query;
        const history = await ContractsService.findArtistHistory(req.user.uid, {
            skip: skip ? Number(skip) : 0,
            take: take ? Number(take) : 20,
            filterField: filterField ? String(filterField) : undefined,
            filterValue: filterValue ? String(filterValue) : undefined,
        });
        return sendSuccess(res, history, 'Artist contracts history retrieved');
    }

    /**
     * GET /api/contracts/:id
     */
    static async getById(req: AuthRequest, res: Response): Promise<Response> {
        if (!req.user) return sendError({ res, error: 'Unauthorized', statusCode: 401 });

        try {
            const { id } = req.params;
            const contract = await ContractsService.findById(id as string, req.user.uid);
            return sendSuccess(res, contract);
        } catch (error: any) {
            return sendError({ res, error: error.message, statusCode: 403 });
        }
    }

    /**
     * POST /api/contracts
     */
    static async create(req: AuthRequest, res: Response): Promise<Response> {
        if (!req.user) return sendError({ res, error: 'Unauthorized', statusCode: 401 });

        const { artistId, serviceId, eventDetails, totalAmount, clientSignatureDataUrl, acceptedTerms } = req.body;
        
        if (!artistId || !serviceId || !eventDetails || !totalAmount) {
            return sendError({ res, error: 'Missing required fields', statusCode: 400 });
        }
        
        if (!clientSignatureDataUrl || acceptedTerms !== true) {
            return sendError({
                res,
                error: 'Client signature and accepted terms are required',
                statusCode: 400,
            });
        }

        try {
            const contract = await ContractsService.createContract(req.user.uid, req.body);
            return sendSuccess(res, contract, 'Contract created successfully', 201);
        } catch (error: any) {
            return sendError({ res, error: error.message, statusCode: 500 });
        }
    }

    /**
     * PATCH /api/contracts/:id/status
     */
    static async updateStatus(req: AuthRequest, res: Response): Promise<Response> {
        if (!req.user) return sendError({ res, error: 'Unauthorized', statusCode: 401 });

        const { id } = req.params;
        const { status, artistSignatureDataUrl, acceptedTerms, rejectionReason } = req.body;

        try {
            const contract = await ContractsService.updateStatus(id as string, req.user.uid, status, {
                artistSignatureDataUrl,
                acceptedTerms,
                rejectionReason,
            });
            return sendSuccess(res, contract, `Contract status updated to ${status}`);
        } catch (error: any) {
            return sendError({ res, error: error.message, statusCode: 403 });
        }
    }

    /**
     * POST /api/contracts/:id/payments
     */
    static async addPayment(req: AuthRequest, res: Response): Promise<Response> {
        if (!req.user) return sendError({ res, error: 'Unauthorized', statusCode: 401 });

        const { id } = req.params;

        try {
            const contract = await ContractsService.addPayment(id as string, req.user.uid, req.body);
            return sendSuccess(res, contract, 'Payment registered successfully');
        } catch (error: any) {
            return sendError({ res, error: error.message, statusCode: 403 });
        }
    }

    /**
     * POST /api/contracts/:id/cancel
     */
    static async cancelByClient(req: AuthRequest, res: Response): Promise<Response> {
        if (!req.user) return sendError({ res, error: 'Unauthorized', statusCode: 401 });

        const { id } = req.params;
        try {
            const contract = await ContractsService.cancelByClient(id as string, req.user.uid);
            return sendSuccess(res, contract, 'Contract cancelled successfully');
        } catch (error: any) {
            return sendError({ res, error: error.message, statusCode: 403 });
        }
    }

    /**
     * POST /api/contracts/bulk-sign
     */
    static async signAll(req: AuthRequest, res: Response): Promise<Response> {
        if (!req.user) return sendError({ res, error: 'Unauthorized', statusCode: 401 });

        try {
            const results = await ContractsService.bulkSignAccepted(req.user.uid);
            return sendSuccess(res, results, 'All pending contracts signed successfully');
        } catch (error: any) {
            return sendError({ res, error: error.message, statusCode: 500 });
        }
    }
}
