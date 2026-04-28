import { Response } from 'express';
import { ApiResponse } from '../types';

export const sendSuccess = <T>(
    res: Response,
    data: T,
    message = 'OK',
    statusCode = 200
): Response => {
    const body: ApiResponse<T> = { success: true, data, message };
    return res.status(statusCode).json(body);
};

export const sendError = (
    {
        res,
        error,
        statusCode,
        code,
        details
    }: {
        res: Response,
        error: string,
        statusCode: number,
        code?: string,
        details?: any
    }
): Response => {
    const body: ApiResponse = { 
        success: false, 
        error: error || 'An unexpected error occurred',
        ...(code ? { code } : {}),
        ...(details ? { data: details } : {})
    };
    return res.status(statusCode).json(body);
};

export const sendCreated = <T>(res: Response, data: T, message = 'Created'): Response =>
    sendSuccess(res, data, message, 201);

export const sendNotFound = (res: Response, message = 'Not found'): Response =>
    sendError({ res, error: message, statusCode: 404 });

export const sendUnauthorized = (res: Response, message = 'Unauthorized'): Response =>
    sendError({ res, error: message, statusCode: 401 });

export const sendForbidden = (res: Response, message = 'Forbidden'): Response =>
    sendError({ res, error: message, statusCode: 403 });
