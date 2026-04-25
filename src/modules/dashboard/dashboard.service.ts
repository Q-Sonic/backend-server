import { getFirestore, admin } from '../../config/firebase';
import { DashboardStats, ContractRecord, ArtistProfileRecord } from '../../types';
import { ContractStatus } from '../../enum/contract.enum';

const ORDERS_COLLECTION = 'orders';
const PROFILES_COLLECTION = 'artist_profiles';

export class DashboardService {
    private db: admin.firestore.Firestore;

    constructor() {
        this.db = getFirestore();
    }

    async getStats(artistUid: string): Promise<DashboardStats> {
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // 1. Fetch contracts to count events
        const contractsSnapshot = await this.db
            .collection('contracts')
            .where('artistId', '==', artistUid)
            .where('status', 'in', [ContractStatus.ACCEPTED, ContractStatus.COMPLETED])
            .get();

        const totalEventsCurr = contractsSnapshot.size;

        // 2. Profile Visits, History & REAL BALANCE
        const profileDoc = await this.db.collection(PROFILES_COLLECTION).doc(artistUid).get();
        const profileData = profileDoc.exists ? (profileDoc.data() as any) : null;

        const totalBalance = profileData?.balance || profileData?.totalBalance || 0;
        const profileVisitsTotal = profileData?.totalVisits || 0;
        const visitsHistory = profileData?.visitsHistory || {};

        // 3. Next event (Fetch all ACCEPTED and filter in-memory to avoid complex index requirement)
        const upcomingSnapshot = await this.db
            .collection('contracts')
            .where('artistId', '==', artistUid)
            .where('status', '==', ContractStatus.ACCEPTED)
            .get();
        
        const nowMillis = now.getTime();
        const futureEvents = upcomingSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as ContractRecord))
            .filter(contract => {
                const eventDate = contract.eventDetails?.date?.toDate?.() || new Date(0);
                return eventDate.getTime() >= nowMillis;
            })
            .sort((a, b) => {
                const at = a.eventDetails?.date?.toMillis?.() || 0;
                const bt = b.eventDetails?.date?.toMillis?.() || 0;
                return at - bt;
            });

        let nextEvent = futureEvents.length > 0 ? futureEvents[0] as any : undefined;

        if (nextEvent) {
            const clientDoc = await this.db.collection('users').doc(nextEvent.clientId).get();
            if (clientDoc.exists) {
                nextEvent.clientName = clientDoc.data()?.displayName || 'Cliente';
            }
        }

        // 4. Growth calculation (Placeholder - would need monthly comparison)
        const eventsGrowthPercent = totalEventsCurr > 0 ? 5 : 0; // Simple placeholder for now

        // 5. Generate chart data
        const visitsChartData = this.generateWeeklyVisits(visitsHistory);

        return {
            totalEvents: totalEventsCurr,
            eventsGrowthPercent,
            totalBalance,
            profileVisitsTotal,
            visitsChartData,
            nextEvent,
        };
    }

    private generateWeeklyVisits(history: Record<string, number>) {
        const result = [];
        const daysShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = daysShort[d.getDay()];
            result.push({
                day: dayName,
                count: history[dateStr] || 0
            });
        }
        return result;
    }
}
