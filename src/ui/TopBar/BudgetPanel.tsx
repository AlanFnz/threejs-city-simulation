interface BudgetPanelProps {
  money: number;
  income: number;
  upkeep: number;
  netIncome: number;
}

function formatMoney(amount: number): string {
  return `$${Math.abs(amount).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function BudgetPanel({
  money,
  income,
  upkeep,
  netIncome,
}: BudgetPanelProps) {
  const netTone =
    netIncome > 0 ? 'positive' : netIncome < 0 ? 'negative' : 'neutral';
  const netSign = netIncome > 0 ? '+' : netIncome < 0 ? '−' : '';

  return (
    <div
      id="city-budget-panel"
      className="city-budget-panel"
      role="dialog"
      aria-label="City budget overview"
    >
      <header>
        <span>
          <small>City economy</small>
          <strong>Budget overview</strong>
        </span>
        <span className="budget-balance">
          <small>Balance</small>
          <strong>${Math.floor(money).toLocaleString()}</strong>
        </span>
      </header>
      <div className="budget-lines">
        <div className="budget-line income">
          <span>
            <i aria-hidden="true">↗</i>
            Tax revenue
          </span>
          <strong>+{formatMoney(income)}</strong>
        </div>
        <div className="budget-line upkeep">
          <span>
            <i aria-hidden="true">↘</i>
            Infrastructure upkeep
          </span>
          <strong>−{formatMoney(upkeep)}</strong>
        </div>
        <div className={`budget-line budget-net ${netTone}`}>
          <span>Net cash flow</span>
          <strong>
            {netSign}
            {formatMoney(netIncome)} / tick
          </strong>
        </div>
      </div>
    </div>
  );
}

export { BudgetPanel };
