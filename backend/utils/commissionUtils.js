// utils/commissionUtils.js

const calculateCommission = (loanAmount, referrerId) => {
    const maxCommission = loanAmount * 0.003; // Max payout: 0.3%
    let referrerCommission = null;
    let agentCommission = maxCommission;

    if (referrerId) {
        // Example logic: Referrer gets RM100 per 100k loan or max RM300
        referrerCommission = Math.min((loanAmount / 100000) * 100, 300);
        agentCommission = maxCommission - referrerCommission;
    }

    return {
        maxCommission,
        referrerCommission,
        agentCommission,
    };
};

module.exports = { calculateCommission };
