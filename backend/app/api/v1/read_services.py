"""
O-Finance Read-Only Domain Services Endpoints (/api/v1/*)
Provides read-only endpoints for accounts, connectors, transactions, portfolio, market data, ledger entries, and sync triggers.
Ensures zero 404 errors when running frontend with VITE_DEMO_MODE=false.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter

router = APIRouter(tags=["Read-Only Subsystem Feeds"])

# Mock / seed fallback datasets matching frontend types and mock structures
INITIAL_ACCOUNTS = [
    {
        "id": "ACC-001",
        "institution": "JPMorgan Chase",
        "accountName": "Primary Operating Checking",
        "accountNumberMasked": "•••• 4821",
        "accountType": "Checking",
        "currency": "USD",
        "currentBalance": 42150.80,
        "availableCash": 42150.80,
        "investmentValue": 0.0,
        "liabilityAmount": 0.0,
        "connectionStatus": "Connected",
        "dataFreshness": "Synced 10m ago",
        "region": "US",
        "connectorId": "CONN-JPMC",
    },
    {
        "id": "ACC-002",
        "institution": "Charles Schwab",
        "accountName": "Core Investment Brokerage",
        "accountNumberMasked": "•••• 9104",
        "accountType": "Brokerage",
        "currency": "USD",
        "currentBalance": 284910.45,
        "availableCash": 18450.00,
        "investmentValue": 266460.45,
        "liabilityAmount": 0.0,
        "connectionStatus": "Connected",
        "dataFreshness": "Synced 5m ago",
        "region": "US",
        "connectorId": "CONN-SCHW",
    },
    {
        "id": "ACC-003",
        "institution": "Interactive Brokers",
        "accountName": "Global Multi-Currency Trading",
        "accountNumberMasked": "•••• 3319",
        "accountType": "Brokerage",
        "currency": "USD",
        "currentBalance": 145200.00,
        "availableCash": 32100.00,
        "investmentValue": 113100.00,
        "liabilityAmount": 0.0,
        "connectionStatus": "Connected",
        "dataFreshness": "Synced 15m ago",
        "region": "US",
        "connectorId": "CONN-IBKR",
    },
    {
        "id": "ACC-004",
        "institution": "HSBC UK",
        "accountName": "Sterling Treasury Account",
        "accountNumberMasked": "•••• 7712",
        "accountType": "Savings",
        "currency": "GBP",
        "currentBalance": 35800.00,
        "availableCash": 35800.00,
        "investmentValue": 0.0,
        "liabilityAmount": 0.0,
        "connectionStatus": "Connected",
        "dataFreshness": "Synced 1h ago",
        "region": "UK",
        "connectorId": "CONN-HSBC",
    },
    {
        "id": "ACC-005",
        "institution": "Bank of China",
        "accountName": "RMB Settlement Savings",
        "accountNumberMasked": "•••• 6888",
        "accountType": "Savings",
        "currency": "CNY",
        "currentBalance": 185000.00,
        "availableCash": 185000.00,
        "investmentValue": 0.0,
        "liabilityAmount": 0.0,
        "connectionStatus": "Connected",
        "dataFreshness": "Synced 2h ago",
        "region": "CN",
        "connectorId": "CONN-BOC",
    },
]

INITIAL_CONNECTORS = [
    {
        "id": "CONN-JPMC",
        "name": "JPMorgan Chase Direct API",
        "institution": "JPMorgan Chase",
        "status": "Connected",
        "type": "OFX/Direct API",
        "lastSynced": "2026-11-02 14:20:00 UTC",
        "accountsLinked": 1,
        "hasAnomaly": False,
    },
    {
        "id": "CONN-SCHW",
        "name": "Schwab Open API Gateway",
        "institution": "Charles Schwab",
        "status": "Connected",
        "type": "REST API",
        "lastSynced": "2026-11-02 14:25:00 UTC",
        "accountsLinked": 1,
        "hasAnomaly": False,
    },
    {
        "id": "CONN-IBKR",
        "name": "Interactive Brokers Flex Web Service",
        "institution": "Interactive Brokers",
        "status": "Connected",
        "type": "Flex Web Service",
        "lastSynced": "2026-11-02 14:15:00 UTC",
        "accountsLinked": 1,
        "hasAnomaly": False,
    },
    {
        "id": "CONN-HSBC",
        "name": "HSBC Open Banking UK API",
        "institution": "HSBC UK",
        "status": "Connected",
        "type": "Open Banking PSD2",
        "lastSynced": "2026-11-02 13:30:00 UTC",
        "accountsLinked": 1,
        "hasAnomaly": False,
    },
    {
        "id": "CONN-BOC",
        "name": "Bank of China Open Banking API",
        "institution": "Bank of China",
        "status": "Connected",
        "type": "Open Banking API",
        "lastSynced": "2026-11-02 12:00:00 UTC",
        "accountsLinked": 1,
        "hasAnomaly": False,
    },
]

INITIAL_TRANSACTIONS = [
    {
        "id": "TX-1001",
        "accountId": "ACC-001",
        "date": "2026-11-01",
        "type": "Deposit",
        "category": "Income: Salary",
        "description": "Monthly Payroll Direct Deposit",
        "payee": "Acme Corp Payroll",
        "amount": 12500.00,
        "currency": "USD",
        "ledgerStatus": "Posted",
    },
    {
        "id": "TX-1002",
        "accountId": "ACC-001",
        "date": "2026-11-01",
        "type": "Transfer",
        "category": "Transfer: Brokerage Funding",
        "description": "Outbound Transfer to Schwab Brokerage",
        "payee": "Charles Schwab",
        "amount": -5000.00,
        "currency": "USD",
        "ledgerStatus": "Posted",
        "transferPairId": "TX-1003",
    },
    {
        "id": "TX-1003",
        "accountId": "ACC-002",
        "date": "2026-11-01",
        "type": "Transfer",
        "category": "Transfer: Checking Deposit",
        "description": "Inbound Transfer from Chase Checking",
        "payee": "JPMorgan Chase",
        "amount": 5000.00,
        "currency": "USD",
        "ledgerStatus": "Posted",
        "transferPairId": "TX-1002",
    },
]

INITIAL_HOLDINGS = [
    {
        "id": "HOLD-001",
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "assetClass": "Equities",
        "sector": "Information Technology",
        "quantity": 450,
        "costBasis": 165.20,
        "currentPrice": 232.50,
        "marketValue": 104625.00,
        "unrealizedGainLoss": 30285.00,
        "unrealizedGainLossPct": 40.71,
        "currency": "USD",
        "accountId": "ACC-002",
    },
    {
        "id": "HOLD-002",
        "symbol": "NVDA",
        "name": "NVIDIA Corporation",
        "assetClass": "Equities",
        "sector": "Semiconductors",
        "quantity": 600,
        "costBasis": 45.80,
        "currentPrice": 141.20,
        "marketValue": 84720.00,
        "unrealizedGainLoss": 57240.00,
        "unrealizedGainLossPct": 208.29,
        "currency": "USD",
        "accountId": "ACC-002",
    },
    {
        "id": "HOLD-003",
        "symbol": "MSFT",
        "name": "Microsoft Corporation",
        "assetClass": "Equities",
        "sector": "Information Technology",
        "quantity": 180,
        "costBasis": 320.00,
        "currentPrice": 428.10,
        "marketValue": 77058.00,
        "unrealizedGainLoss": 19458.00,
        "unrealizedGainLossPct": 33.78,
        "currency": "USD",
        "accountId": "ACC-002",
    },
]

NET_WORTH_HISTORY_12M = [
    {"date": "2025-12", "netWorth": 485000.00, "investments": 320000.00, "cash": 165000.00},
    {"date": "2026-01", "netWorth": 492000.00, "investments": 328000.00, "cash": 164000.00},
    {"date": "2026-02", "netWorth": 501000.00, "investments": 336000.00, "cash": 165000.00},
    {"date": "2026-03", "netWorth": 510000.00, "investments": 345000.00, "cash": 165000.00},
    {"date": "2026-04", "netWorth": 518000.00, "investments": 352000.00, "cash": 166000.00},
    {"date": "2026-05", "netWorth": 526000.00, "investments": 359000.00, "cash": 167000.00},
    {"date": "2026-06", "netWorth": 535000.00, "investments": 367000.00, "cash": 168000.00},
    {"date": "2026-07", "netWorth": 542000.00, "investments": 373000.00, "cash": 169000.00},
    {"date": "2026-08", "netWorth": 551000.00, "investments": 381000.00, "cash": 170000.00},
    {"date": "2026-09", "netWorth": 560000.00, "investments": 389000.00, "cash": 171000.00},
    {"date": "2026-10", "netWorth": 570000.00, "investments": 398000.00, "cash": 172000.00},
    {"date": "2026-11", "netWorth": 580000.00, "investments": 408000.00, "cash": 172000.00},
]

CASH_FLOW_12M = [
    {"date": "2025-12", "inflow": 12500.00, "outflow": -6200.00, "net": 6300.00},
    {"date": "2026-01", "inflow": 12500.00, "outflow": -5800.00, "net": 6700.00},
    {"date": "2026-02", "inflow": 13000.00, "outflow": -6100.00, "net": 6900.00},
    {"date": "2026-03", "inflow": 12500.00, "outflow": -5900.00, "net": 6600.00},
    {"date": "2026-04", "inflow": 12500.00, "outflow": -6300.00, "net": 6200.00},
    {"date": "2026-05", "inflow": 14000.00, "outflow": -6000.00, "net": 8000.00},
    {"date": "2026-06", "inflow": 12500.00, "outflow": -5700.00, "net": 6800.00},
    {"date": "2026-07", "inflow": 12500.00, "outflow": -6400.00, "net": 6100.00},
    {"date": "2026-08", "inflow": 13500.00, "outflow": -6100.00, "net": 7400.00},
    {"date": "2026-09", "inflow": 12500.00, "outflow": -5900.00, "net": 6600.00},
    {"date": "2026-10", "inflow": 12500.00, "outflow": -6200.00, "net": 6300.00},
    {"date": "2026-11", "inflow": 12500.00, "outflow": -5500.00, "net": 7000.00},
]

INITIAL_WATCHLIST = [
    {"symbol": "AAPL", "name": "Apple Inc.", "price": 232.50, "changePct": 1.45, "currency": "USD"},
    {"symbol": "NVDA", "name": "NVIDIA Corp.", "price": 141.20, "changePct": 3.82, "currency": "USD"},
    {"symbol": "MSFT", "name": "Microsoft Corp.", "price": 428.10, "changePct": -0.65, "currency": "USD"},
    {"symbol": "TSM", "name": "Taiwan Semiconductor", "price": 194.80, "changePct": 2.10, "currency": "USD"},
]

ECONOMIC_CALENDAR_EVENTS = [
    {"date": "2026-11-06", "event": "US Non-Farm Payrolls & Unemployment Rate", "importance": "High", "actual": "182K", "forecast": "170K", "previous": "154K"},
    {"date": "2026-11-12", "event": "US Consumer Price Index (CPI YoY)", "importance": "High", "actual": "--", "forecast": "2.4%", "previous": "2.5%"},
]

INITIAL_JOURNAL_ENTRIES = [
    {
        "id": "JE-2026-001",
        "date": "2026-11-01",
        "flag": "*",
        "payee": "Acme Corp Payroll",
        "narration": "Monthly Payroll Direct Deposit",
        "postings": [
            {"account": "Assets:USD:Chase:Checking", "amount": 12500.00, "currency": "USD"},
            {"account": "Income:Salary", "amount": -12500.00, "currency": "USD"},
        ],
        "status": "Posted",
        "sourceTransactionId": "TX-1001",
    }
]

INITIAL_BACKTESTS = [
    {
        "id": "EXP-2026-001",
        "strategyId": "strat-ma-cross",
        "strategyName": "Dual Moving Average Crossover",
        "symbol": "AAPL",
        "benchmark": "S&P 500 (SPX)",
        "startDate": "2025-11-01",
        "endDate": "2026-11-01",
        "initialCapital": 100000.00,
        "commissionBps": 5.0,
        "slippageBps": 2.0,
        "metrics": {
            "totalReturnPct": 18.42,
            "annualizedReturnPct": 18.42,
            "benchmarkReturnPct": 12.10,
            "sharpeRatio": 1.68,
            "sortinoRatio": 2.14,
            "maxDrawdownPct": -8.45,
            "winRatePct": 62.5,
            "profitFactor": 1.85,
        },
    }
]


@router.get("/accounts", summary="Get Accounts List")
async def get_accounts() -> List[Dict[str, Any]]:
    return INITIAL_ACCOUNTS


@router.get("/connectors", summary="Get Connectors List")
async def get_connectors() -> List[Dict[str, Any]]:
    return INITIAL_CONNECTORS


@router.get("/transactions", summary="Get Transactions List")
async def get_transactions() -> List[Dict[str, Any]]:
    return INITIAL_TRANSACTIONS


@router.get("/portfolio/holdings", summary="Get Portfolio Holdings")
async def get_portfolio_holdings() -> List[Dict[str, Any]]:
    return INITIAL_HOLDINGS


@router.get("/portfolio/history", summary="Get Portfolio Net Worth History")
async def get_portfolio_history() -> List[Dict[str, Any]]:
    return NET_WORTH_HISTORY_12M


@router.get("/portfolio/cashflow", summary="Get Portfolio Cash Flow History")
async def get_portfolio_cashflow() -> List[Dict[str, Any]]:
    return CASH_FLOW_12M


@router.get("/market/watchlist", summary="Get Market Watchlist")
async def get_market_watchlist() -> List[Dict[str, Any]]:
    return INITIAL_WATCHLIST


@router.get("/market/calendar", summary="Get Economic Calendar Events")
async def get_market_calendar() -> List[Dict[str, Any]]:
    return ECONOMIC_CALENDAR_EVENTS


@router.get("/ledger/entries", summary="Get Journal Entries List")
async def get_ledger_entries() -> List[Dict[str, Any]]:
    return INITIAL_JOURNAL_ENTRIES


@router.get("/quant/backtests", summary="Get Backtest Registry List")
async def get_quant_backtests() -> List[Dict[str, Any]]:
    return INITIAL_BACKTESTS


@router.post("/sync/trigger", summary="Trigger Simulated Connector Sync")
async def trigger_simulated_sync(payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    target = (payload or {}).get("targetInstitution", "All Demo Accounts")
    return {
        "timestamp": "2026-11-06 03:24:00 UTC",
        "status": "Simulated Sync Completed — No Real Financial Institution Connected",
        "target": target,
    }
