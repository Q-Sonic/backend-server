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

        // 1. Fetch orders (instead of contracts)
        const allOrdersSnapshot = await this.db
            .collection(ORDERS_COLLECTION)
            .where('userId', '==', artistUid) // Note: Need to verify if artist is userId or another field
            .get();

        // 2. Profile Visits, History & REAL BALANCE
        const profileDoc = await this.db.collection(PROFILES_COLLECTION).doc(artistUid).get();
        const profileData = profileDoc.exists ? (profileDoc.data() as any) : null;

        // Use the balance field from the profile as requested by the real data schema
        const totalBalance = profileData?.balance || 0;
        const profileVisitsTotal = profileData?.totalVisits || 0;
        const visitsHistory = profileData?.visitsHistory || {};

        // 3. Growth calculation (Placeholder if orders don't have createdAt as expected)
        const totalEventsCurr = 0; // Needs adjustment based on orders/contracts reality
        const eventsGrowthPercent = 0;

        // 4. Generate chart data
        const visitsChartData = this.generateWeeklyVisits(visitsHistory);

        return {
            totalEvents: totalEventsCurr,
            eventsGrowthPercent,
            totalBalance,
            profileVisitsTotal,
            visitsChartData,
            // nextEvent is omitted for now as 'orders' schema doesn't match 'ContractRecord'
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
