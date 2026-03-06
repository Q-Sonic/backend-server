import { Request, Response } from 'express';
import { UsersService } from './users.service';
import {
    sendSuccess,
    sendError,
    sendNotFound,
} from '../../utils/response.util';

const usersService = new UsersService();

export async function getAllUsers(_req: Request, res: Response): Promise<void> {
    try {
        const users = await usersService.findAll();
        sendSuccess(res, users);
    } catch (err) {
        sendError({ res, error: err instanceof Error ? err.message : 'Failed to fetch users', statusCode: 500 });
    }
}

export async function getUserById(req: Request, res: Response): Promise<void> {
    try {
        const user = await usersService.findById(String(req.params.id));
        sendSuccess(res, user);
    } catch (err) {
        sendNotFound(res, err instanceof Error ? err.message : 'User not found');
    }
}

export async function updateUser(req: Request, res: Response): Promise<void> {
    try {
        const updated = await usersService.update(String(req.params.id), req.body);
        sendSuccess(res, updated, 'User updated');
    } catch (err) {
        sendError({ res, error: err instanceof Error ? err.message : 'Update failed', statusCode: 400 });
    }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
    try {
        await usersService.delete(String(req.params.id));
        sendSuccess(res, null, 'User deleted');
    } catch (err) {
        sendNotFound(res, err instanceof Error ? err.message : 'User not found');
    }
}

export async function createArtist(req: Request, res: Response): Promise<void> {
    try {
        const { email, password, displayName } = req.body;

        if (!email || !password || !displayName) {
            sendError({ res, error: 'Email, password and display name are required', statusCode: 400 });
            return;
        }

        const newUser = await usersService.createArtist(email, password, displayName);
        sendSuccess(res, newUser, 'Artist account created successfully', 201);
    } catch (err: any) {
        sendError({ res, error: err.message || 'Failed to create artist', statusCode: 500 });
    }
}
