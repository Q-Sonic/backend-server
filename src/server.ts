import { getEnv } from './config/env';
import { initFirebase } from './config/firebase';
import app from './app';

async function bootstrap(): Promise<void> {
    // 1. Validate env & initialize Firebase before anything else
    const { PORT, NODE_ENV } = getEnv();
    initFirebase();

    // 2. Start HTTP server
    app.listen(PORT, () => {
        console.log(`Q-Music Backend running on port ${PORT} [${NODE_ENV}]`);
        console.log(`Health: http://localhost:${PORT}/api/health`);
    });
}

bootstrap().catch((err: unknown) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
});
