import { getFirestore, admin } from '../../config/firebase';
import { DashboardStats, ContractRecord } from '../../types';
import { ContractStatus } from '../../enum/contract.enum';

const PROFILES_COLLECTION = 'artist_profiles';
const VISITS_DAILY_COLLECTION = 'artist_profile_visits_daily';

function parseUnknownDate(raw: unknown): Date | null {
    if (!raw) return null;
    if (raw instanceof Date) {
        return Number.isNaN(raw.getTime()) ? null : raw;
    }

    if (typeof raw === 'string' || typeof raw === 'number') {
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    if (typeof raw === 'object') {
        const candidate = raw as {
            toDate?: () => Date;
            toMillis?: () => number;
            seconds?: number;
            _seconds?: number;
            nanoseconds?: number;
            _nanoseconds?: number;
        };

        if (typeof candidate.toDate === 'function') {
            const d = candidate.toDate();
            return Number.isNaN(d.getTime()) ? null : d;
        }

        if (typeof candidate.toMillis === 'function') {
            const d = new Date(candidate.toMillis());
            return Number.isNaN(d.getTime()) ? null : d;
        }

        const seconds = candidate.seconds ?? candidate._seconds;
        const nanos = candidate.nanoseconds ?? candidate._nanoseconds;
        if (typeof seconds === 'number') {
            const millis = seconds * 1000 + (typeof nanos === 'number' ? nanos / 1e6 : 0);
            const d = new Date(millis);
            return Number.isNaN(d.getTime()) ? null : d;
        }
    }

    return null;
}

function contractEventDate(contract: ContractRecord): Date | null {
    return parseUnknownDate(contract.eventDetails?.date);
}

function numberFromUnknown(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
}

function isDateInCalendarMonth(d: Date, year: number, monthIndex0: number): boolean {
    return d.getFullYear() === year && d.getMonth() === monthIndex0;
}

function toDateKeyLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export class DashboardService {
    private db: admin.firestore.Firestore;

    constructor() {
        this.db = getFirestore();
    }

    async getStats(artistUid: string): Promise<DashboardStats> {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const lastMonthY = m === 0 ? y - 1 : y;
        const lastMonthM = m === 0 ? 11 : m - 1;

        // 1. Fetch contracts to count events (by event date in current vs previous month)
        const contractsSnapshot = await this.db
            .collection('contracts')
            .where('artistId', '==', artistUid)
            .where('status', 'in', [ContractStatus.PENDING, ContractStatus.ACCEPTED, ContractStatus.COMPLETED])
            .get();

        let eventsThisMonth = 0;
        let eventsLastMonth = 0;
        for (const doc of contractsSnapshot.docs) {
            const contract = { id: doc.id, ...doc.data() } as ContractRecord;
            const eventDate = contractEventDate(contract);
            if (!eventDate) continue;
            if (isDateInCalendarMonth(eventDate, y, m)) eventsThisMonth += 1;
            else if (isDateInCalendarMonth(eventDate, lastMonthY, lastMonthM)) eventsLastMonth += 1;
        }

        const totalEventsCurr = eventsThisMonth;
        const eventsGrowthPercent =
            eventsLastMonth === 0
                ? eventsThisMonth > 0
                    ? 100
                    : 0
                : Math.round(((eventsThisMonth - eventsLastMonth) / eventsLastMonth) * 100);

        // 2. Profile Visits, History & REAL BALANCE
        const profileDoc = await this.db.collection(PROFILES_COLLECTION).doc(artistUid).get();
        const profileData = profileDoc.exists ? (profileDoc.data() as any) : null;

        const totalBalance = numberFromUnknown(
            profileData?.totalBalance ?? profileData?.balance ?? profileData?.walletBalance,
            0,
        );
        const profileVisitsTotal = numberFromUnknown(profileData?.totalVisits ?? profileData?.visits, 0);

        // 3. Next event (Fetch all ACCEPTED and filter in-memory to avoid complex index requirement)
        const upcomingSnapshot = await this.db
            .collection('contracts')
            .where('artistId', '==', artistUid)
            .where('status', 'in', [ContractStatus.PENDING, ContractStatus.ACCEPTED, ContractStatus.COMPLETED])
            .get();
        
        const nowMillis = now.getTime();
        const futureEvents = upcomingSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as ContractRecord))
            .filter(contract => {
                const eventDate = contractEventDate(contract);
                return !!eventDate && eventDate.getTime() >= nowMillis;
            })
            .sort((a, b) => {
                const at = contractEventDate(a)?.getTime() || 0;
                const bt = contractEventDate(b)?.getTime() || 0;
                return at - bt;
            });

        let nextEvent = futureEvents.length > 0 ? futureEvents[0] as any : undefined;

        if (nextEvent) {
            const clientDoc = await this.db.collection('users').doc(nextEvent.clientId).get();
            if (clientDoc.exists) {
                nextEvent.clientName = clientDoc.data()?.displayName || 'Cliente';
            }
        }

        // 4. Generate chart data from dedicated daily visits collection (fallback to legacy map)
        const visitsChartData = await this.generateWeeklyVisits(artistUid, profileData?.visitsHistory || {});

        return {
            totalEvents: totalEventsCurr,
            eventsGrowthPercent,
            totalBalance,
            profileVisitsTotal,
            visitsChartData,
            nextEvent,
        };
    }

    private async generateWeeklyVisits(artistUid: string, legacyHistory: Record<string, number>) {
        const dailyVisitsSnapshot = await this.db
            .collection(VISITS_DAILY_COLLECTION)
            .where('artistId', '==', artistUid)
            .get();

        const dailyCountByDate = new Map<string, number>();
        dailyVisitsSnapshot.docs.forEach((doc) => {
            const data = doc.data() as { date?: unknown; count?: unknown };
            const dateKey = typeof data.date === 'string' ? data.date : '';
            if (!dateKey) return;
            dailyCountByDate.set(dateKey, numberFromUnknown(data.count, 0));
        });

        const result = [];
        const daysShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = toDateKeyLocal(d);
            const dayName = daysShort[d.getDay()];
            result.push({
                day: dayName,
                count: dailyCountByDate.get(dateStr) ?? numberFromUnknown(legacyHistory?.[dateStr], 0)
            });
        }
        return result;
    }
}
