# routers/audit.py — Compliance audit log endpoints

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from typing import Optional
import audit_logger

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/dates")
async def list_dates():
    """List all dates for which audit log files exist."""
    return {"dates": audit_logger.list_log_dates()}


@router.get("/logs")
async def get_logs(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format; defaults to today"),
    limit: int = Query(200, description="Maximum records to return"),
    user_filter: Optional[str] = Query(None, description="Filter by user (optional)"),
):
    """Return parsed audit log entries for a given date."""
    entries = audit_logger.read_logs(date_str=date, limit=limit, user_filter=user_filter)
    return {"entries": entries, "total": len(entries), "date": date}


@router.get("/verify")
async def verify_chain(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format; defaults to today"),
):
    """Verify the integrity of the audit log chain for a given date."""
    return audit_logger.verify_chain(date_str=date)


@router.get("/export")
async def export_logs(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format; defaults to today"),
):
    """Download the raw JSONL log file for a given date."""
    from datetime import datetime, timezone
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    path = audit_logger.get_log_file_path(date)
    if not path:
        raise HTTPException(status_code=404, detail=f"No audit log found for {date}")

    return FileResponse(
        path=path,
        media_type="application/jsonlines",
        filename=f"legalbox-audit-{date}.jsonl",
    )
