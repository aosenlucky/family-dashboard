export function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function getMonthlyInterest(loan = {}) {
  const principal = Math.max(0, toNumber(loan.left))
  const monthlyRate = Math.max(0, toNumber(loan.rate)) / 100 / 12
  return principal * monthlyRate
}

export function getPlannedPrincipal(loan = {}) {
  const explicitPrincipal = toNumber(loan.plannedPrincipal, NaN)
  if (Number.isFinite(explicitPrincipal) && explicitPrincipal >= 0) return explicitPrincipal

  const legacyMonthly = toNumber(loan.monthly, 0)
  if (legacyMonthly > 0) return Math.max(0, legacyMonthly - getMonthlyInterest(loan))
  return 0
}

export function getConsumerLoanPayment(loan = {}) {
  return getPlannedPrincipal(loan) + getMonthlyInterest(loan)
}

export function getRequiredLoanPayment(loan = {}) {
  if (loan.type === '消费贷') return getConsumerLoanPayment(loan)
  return toNumber(loan.baseMonthly || loan.monthly, 0)
}

export function getTransferDelta(transferAmount, requiredAmount) {
  return Math.round(toNumber(requiredAmount) - toNumber(transferAmount))
}
