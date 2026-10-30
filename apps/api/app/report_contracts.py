from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import Field, StrictInt

from app.contracts import Contract

ReportMoney = Annotated[StrictInt, Field(ge=0, le=9007199254740991)]


class ReportAmounts(Contract):
    purchase_committed_paise: ReportMoney = 0
    seller_paid_paise: ReportMoney = 0
    seller_balance_paise: ReportMoney = 0
    recorded_costs_paise: ReportMoney = 0
    warranty_costs_paise: ReportMoney = 0
    buyer_collected_paise: ReportMoney = 0
    buyer_refunded_paise: ReportMoney = 0
    buyer_balance_paise: ReportMoney = 0
    refund_due_paise: ReportMoney = 0
    vendor_paid_paise: ReportMoney = 0
    vendor_balance_paise: ReportMoney = 0
    vendor_advance_paise: ReportMoney = 0


class StockReportRow(ReportAmounts):
    car_id: UUID
    stock_number: str
    car_label: str
    registration: str
    stage: str
    commercial_status: str
    location: str
    stock_age_days: int | None
    open_jobs: int
    waiting_jobs: int
    oldest_due_at: datetime | None


class OperationsReport(Contract):
    cutoff: datetime
    items: list[StockReportRow]
    totals: ReportAmounts
    total: int
    limit: int
    offset: int
