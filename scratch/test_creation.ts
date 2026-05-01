import { ContractsService } from '../src/modules/contracts/contracts.service';

async function test() {
    const service = new ContractsService();
    const result = await service.create('test-client-id', {
        artistId: 'nutri-artist-test-uid',
        serviceId: 'PDolyXET7w8yY4a3TZ9Q',
        totalAmount: 100,
        eventDetails: {
            name: 'Test Manual Antigravity',
            date: '2026-06-01T12:00:00.000Z',
            location: 'Laboratorio de Pruebas'
        }
    });
    console.log(':::: CONTRACT CREATED ::::');
    console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
