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

        // 1. Fetch Profile Data (for visits and balance)
        const profileDoc = await this.db.collection(PROFILES_COLLECTION).doc(artistUid).get();
        const profileData = profileDoc.exists ? (profileDoc.data() as ArtistProfileRecord) : null;

        // 2. Fetch contracts for growth calculation
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

        // 3. Calculate Total Balance (using the profile balance as source of truth)
        const totalBalance = profileData?.balance || 0;

        // 4. Profile Visits & History

        const profileVisitsTotal = profileData?.totalVisits || 0;
        const visitsHistory = profileData?.visitsHistory || {};

        // Generate chart data for the last 7 days (as shown in image)
        const visitsChartData = this.generateWeeklyVisits(visitsHistory);

        // 4. Next Event (upcoming)
        const nextEvent = allContracts
            .filter(c => c.eventDetails.date.toDate() >= now && c.status === ContractStatus.ACCEPTED)
            .sort((a, b) => a.eventDetails.date.toMillis() - b.eventDetails.date.toMillis())[0];

        return {
            totalEvents: totalEventsCurr,
            eventsGrowthPercent: Math.round(eventsGrowthPercent),
            totalBalance,
            profileVisitsTotal,
            visitsChartData,
            nextEvent
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
