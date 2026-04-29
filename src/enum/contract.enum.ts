export enum ContractStatus {
    PENDING = 'pending',
    PENDING_ARTIST_SIGNATURE = 'pending_artist_signature',
    ACCEPTED = 'accepted',
    REJECTED = 'rejected',
    EXPIRED = 'expired',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
}

export enum PaymentStatus {
    UNPAID = 'unpaid',
    PARTIAL = 'partial',
    PAID = 'paid',
}
