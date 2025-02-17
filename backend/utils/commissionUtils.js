// utils/commissionUtils.js
const calculateCommission = (loanAmount, referrerId) => {
    if (isNaN(loanAmount) || loanAmount <= 0) {
      throw new Error("Invalid loan amount provided for commission calculation.");
    }
    
    let maxCommission, referrerCommission, agentCommission;
    
    if (referrerId) {
      maxCommission = loanAmount * 0.003; // Total commission is 0.3%
      referrerCommission = loanAmount * 0.001; // 0.1%
      agentCommission = loanAmount * 0.002;    // 0.2%
    } else {
      maxCommission = loanAmount * 0.003; // Entire 0.3% goes to agent
      referrerCommission = 0;
      agentCommission = maxCommission;
    }
    
    return {
      maxCommission,
      referrerCommission,
      agentCommission,
    };
  };
  
  module.exports = { calculateCommission };
  