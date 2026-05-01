export enum TransactionType {
    INCOME = 'INCOME',
    WITHDRAWAL = 'WITHDRAWAL',
    REFUND = 'REFUND',
    WITHDRAWAL_REVERT = 'WITHDRAWAL_REVERT',
}

export enum WithdrawalStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    COMPLETED = 'completed',
    REJECTED = 'rejected',
}
