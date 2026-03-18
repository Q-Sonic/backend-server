import { getFirestore, admin } from '../../config/firebase';
import { DashboardStats, ContractRecord, ArtistProfileRecord } from '../../types';
import { ContractStatus } from '../../enum/contract.enum';

const CONTRACTS_COLLECTION = 'contracts';
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

        // 1. Fetch contracts for growth calculation
        const allContractsSnapshot = await this.db
            .collection(CONTRACTS_COLLECTION)
            .where('artistId', '==', artistUid)
            .get();

        const allContracts = allContractsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as ContractRecord));

        const currentMonthEvents = allContracts.filter(c => {
            const date = c.createdAt.toDate();
            return date >= startOfCurrentMonth;
        });

        const lastMonthEvents = allContracts.filter(c => {
            const date = c.createdAt.toDate();
            return date >= startOfLastMonth && date <= endOfLastMonth;
        });

        const totalEventsCurr = currentMonthEvents.length;
        const totalEventsLast = lastMonthEvents.length;

        let eventsGrowthPercent = 0;
        if (totalEventsLast > 0) {
            eventsGrowthPercent = ((totalEventsCurr - totalEventsLast) / totalEventsLast) * 100;
        } else if (totalEventsCurr > 0) {
            eventsGrowthPercent = 100; // From 0 to something is 100%
        }

        // 2. Calculate Total Balance (all paid amounts)
        const totalBalance = allContracts.reduce((sum, c) => {
            // Include COMPLETED or any contract with paidAmount
            return sum + (Number(c.financials?.paidAmount) || 0);
        }, 0);

        // 3. Profile Visits & History
        const profileDoc = await this.db.collection(PROFILES_COLLECTION).doc(artistUid).get();
        const profileData = profileDoc.exists ? (profileDoc.data() as ArtistProfileRecord) : null;

        const profileVisitsTotal = profileData?.totalVisits || 0;
        const visitsHistory = profileData?.visitsHistory || {};

        // Generate chart data for the last 7 days (as shown in image)
        const visitsChartData = this.generateWeeklyVisits(visitsHistory);

        return {
            totalEvents: totalEventsCurr,
            eventsGrowthPercent: Math.round(eventsGrowthPercent),
            totalBalance,
            profileVisitsTotal,
            visitsChartData
        };
    }

    private generateWeeklyVisits(history: Record<string, number>) {
        // Today and 6 days before
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
