import logging
import os
import uuid
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.config import settings

logger = logging.getLogger(__name__)

_DEVANAGARI_FONT_PATH = "/usr/share/fonts/truetype/lohit-devanagari/Lohit-Devanagari.ttf"
HINDI_FONT = "Helvetica"
if os.path.exists(_DEVANAGARI_FONT_PATH):
    pdfmetrics.registerFont(TTFont("LohitDevanagari", _DEVANAGARI_FONT_PATH))
    HINDI_FONT = "LohitDevanagari"


def build_diary_pdf(uid: str, entries: list[dict], from_date: str, to_date: str) -> str:
    path = f"/tmp/diary_{uid}_{uuid.uuid4().hex[:8]}.pdf"
    doc = SimpleDocTemplate(path, pagesize=A4)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("Farm Diary Report", styles["Title"]),
        Paragraph(f"{from_date} to {to_date}", styles["Normal"]),
        Spacer(1, 12),
    ]
    rows = [["Date", "Title", "Category", "Type", "Amount"]]
    total_income = 0.0
    total_expense = 0.0
    for entry in entries:
        amount = entry.get("amount", 0)
        if entry.get("type") == "income":
            total_income += amount
        elif entry.get("type") == "expense":
            total_expense += amount
        rows.append(
            [
                entry.get("date", ""),
                entry.get("title", ""),
                entry.get("category", ""),
                entry.get("type", ""),
                f"Rs {amount}",
            ]
        )
    rows.append(["", "Total Income", "", "", f"Rs {total_income}"])
    rows.append(["", "Total Expense", "", "", f"Rs {total_expense}"])
    rows.append(["", "Net", "", "", f"Rs {total_income - total_expense}"])
    table = Table(rows, colWidths=[70, 160, 90, 80, 90])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#43A047")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTNAME", (0, -3), (-1, -1), "Helvetica-Bold"),
                ("LINEABOVE", (0, -3), (-1, -3), 1, colors.black),
            ]
        )
    )
    story.append(table)
    doc.build(story)
    return path


def build_lease_agreement_pdf(lease: dict, landlord: dict, tenant: dict) -> str:
    path = f"/tmp/lease_agreement_{lease['id']}_{uuid.uuid4().hex[:8]}.pdf"
    if HINDI_FONT != "Helvetica":
        heading = "कृषि भूमि पट्टा अनुबंध"
    else:
        heading = "Krishi Bhoomi Patta Anuband (Agricultural Land Lease Agreement)"
    heading_style = ParagraphStyle(
        "HindiTitle", fontName=HINDI_FONT, fontSize=18, spaceAfter=16
    )
    styles = getSampleStyleSheet()
    story = [
        Paragraph(heading, heading_style),
        Paragraph(f"Generated on: {datetime.now(timezone.utc).date().isoformat()}", styles["Normal"]),
        Spacer(1, 12),
    ]
    rows = [
        ["Landlord", landlord.get("name", "")],
        ["Landlord Village", landlord.get("village", "")],
        ["Plot", lease.get("plotName", lease.get("plotId", ""))],
        ["Gat Number", lease.get("gatNumber") or "-"],
        ["Tenant", tenant.get("name", "")],
        ["Tenant Phone", tenant.get("phone", "")],
        ["Monthly Rent", f"Rs {lease.get('monthlyRentRupees', 0)}"],
        ["Lease Start", lease.get("startDate", "")],
        ["Lease End", lease.get("endDate", "")],
    ]
    table = Table(rows, colWidths=[140, 300])
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ]
        )
    )
    story.append(table)
    doc = SimpleDocTemplate(path, pagesize=A4)
    doc.build(story)
    return path


def build_rent_receipt_pdf(lease: dict, payment: dict, landlord: dict) -> str:
    """PDF receipt for one recorded rent payment (phase-02 WS-01)."""
    path = f"/tmp/rent_receipt_{payment.get('id', uuid.uuid4().hex[:8])}.pdf"
    styles = getSampleStyleSheet()
    story = [
        Paragraph("Rent Payment Receipt / किराया भुगतान रसीद", styles["Title"]),
        Paragraph(
            f"Generated on: {datetime.now(timezone.utc).date().isoformat()}", styles["Normal"]
        ),
        Spacer(1, 12),
    ]
    paid_paisa = int(payment.get("amountPaidPaisa", 0) or 0)
    if not paid_paisa:
        paid_paisa = int(round(float(payment.get("amountRupees", 0) or 0) * 100))
    rows = [
        ["Receipt No", payment.get("id", "")],
        ["Landlord", landlord.get("name", "")],
        ["Tenant", lease.get("tenantName", "")],
        ["Plot", lease.get("plotId", "")],
        ["Rent Month", payment.get("month", "")],
        ["Amount Paid", f"Rs {paid_paisa / 100:.2f} ({paid_paisa} paisa)"],
        ["Method", payment.get("method", "")],
        ["Paid At", payment.get("paidAt", "")],
    ]
    table = Table(rows, colWidths=[140, 300])
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ]
        )
    )
    story.append(table)
    doc = SimpleDocTemplate(path, pagesize=A4)
    doc.build(story)
    return path


def build_commission_invoice_pdf(
    booking: dict, transporter: dict, commission_rupees: float, commission_pct: int
) -> str:
    """Per-trip platform commission invoice (phase-02 WS-02, T-commission)."""
    path = f"/tmp/commission_invoice_{booking.get('id', uuid.uuid4().hex[:8])}.pdf"
    styles = getSampleStyleSheet()
    story = [
        Paragraph("Platform Commission Invoice / कमीशन चालान", styles["Title"]),
        Paragraph(
            f"Generated on: {datetime.now(timezone.utc).date().isoformat()}", styles["Normal"]
        ),
        Spacer(1, 12),
    ]
    fare_rupees = float(booking.get("fare") or 0)
    rows = [
        ["Invoice For Trip", booking.get("id", "")],
        ["Transporter", transporter.get("name", "")],
        ["Route", f"{booking.get('pickup', '')} → {booking.get('drop', '')}"],
        ["Trip Date", booking.get("date", "")],
        ["Trip Fare", f"Rs {fare_rupees:.2f}"],
        ["Commission Rate", f"{commission_pct}%"],
        ["Commission Amount", f"Rs {commission_rupees:.2f}"],
    ]
    table = Table(rows, colWidths=[140, 300])
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ]
        )
    )
    story.append(table)
    doc = SimpleDocTemplate(path, pagesize=A4)
    doc.build(story)
    return path


def build_tds_statement_pdf(statement: dict, seller: dict) -> str:
    """TDS 194-O statement for a settlement period (phase-02 WS-03, S6)."""
    path = f"/tmp/tds_statement_{statement.get('txnId', uuid.uuid4().hex[:8])}.pdf"
    styles = getSampleStyleSheet()
    story = [
        Paragraph("TDS 194-O Statement / टीडीएस विवरण", styles["Title"]),
        Paragraph(
            f"Generated on: {datetime.now(timezone.utc).date().isoformat()}", styles["Normal"]
        ),
        Spacer(1, 12),
    ]
    gross_paisa = int(statement.get("grossPaisa", 0))
    tds_paisa = int(statement.get("tdsPaisa", 0))
    rows = [
        ["Statement For", statement.get("txnId", "")],
        ["Seller", seller.get("name", "") or seller.get("businessName", "")],
        ["Seller GSTIN", seller.get("gstin") or seller.get("gstIn") or "—"],
        ["Period", statement.get("period", "")],
        ["Section", statement.get("section", "194-O")],
        ["Gross GMV", f"Rs {gross_paisa / 100:.2f}"],
        ["TDS Rate", "1%"],
        ["TDS Deducted", f"Rs {tds_paisa / 100:.2f}"],
    ]
    table = Table(rows, colWidths=[140, 300])
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ]
        )
    )
    story.append(table)
    doc = SimpleDocTemplate(path, pagesize=A4)
    doc.build(story)
    return path


def build_gst_invoice_pdf(sale: dict, seller: dict) -> str:
    """GST tax invoice per completed sale (phase-02 WS-03, S6)."""
    path = f"/tmp/gst_invoice_{sale.get('id', uuid.uuid4().hex[:8])}.pdf"
    styles = getSampleStyleSheet()
    gstin = seller.get("gstin") or seller.get("gstIn") or ""
    story = [
        Paragraph("GST Invoice / जीएसटी चालान", styles["Title"]),
        Paragraph(
            f"Generated on: {datetime.now(timezone.utc).date().isoformat()}", styles["Normal"]
        ),
        Spacer(1, 12),
    ]
    rows = [
        ["Invoice No.", sale.get("billNumber", "")],
        ["Seller", seller.get("name", "") or seller.get("businessName", "")],
        ["Seller GSTIN", gstin or "—"],
        ["Buyer", sale.get("buyerName", "")],
        ["Item", sale.get("item", "")],
        ["Quantity", f"{sale.get('quantity', '')} {sale.get('unit', '')}"],
        ["Rate per Unit", f"Rs {float(sale.get('ratePerUnit', 0) or 0):.2f}"],
        ["Gross Amount", f"Rs {float(sale.get('grossAmount', 0) or 0):.2f}"],
        ["Mandi Fee", f"Rs {float(sale.get('mandiFee', 0) or 0):.2f}"],
        ["Net Amount", f"Rs {float(sale.get('netAmount', 0) or 0):.2f}"],
        ["Amount Paid", f"Rs {float(sale.get('amountPaid', 0) or 0):.2f}"],
        ["Balance Due", f"Rs {float(sale.get('balanceDue', 0) or 0):.2f}"],
        ["Payment Status", sale.get("status", "")],
    ]
    table = Table(rows, colWidths=[140, 300])
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ]
        )
    )
    story.append(table)
    doc = SimpleDocTemplate(path, pagesize=A4)
    doc.build(story)
    return path


def build_rent_ledger_pdf(lease: dict, payments: list[dict]) -> str:
    """PDF rent ledger for a lease (phase-02 WS-01)."""
    path = f"/tmp/rent_ledger_{lease.get('id', uuid.uuid4().hex[:8])}.pdf"
    styles = getSampleStyleSheet()
    story = [
        Paragraph("Rent Ledger / किराया खाता", styles["Title"]),
        Paragraph(f"Tenant: {lease.get('tenantName', '')}", styles["Normal"]),
        Spacer(1, 12),
    ]
    rows = [["Month", "Amount Paid (paisa)", "Method", "Paid At"]]
    for payment in sorted(payments, key=lambda p: p.get("month", "")):
        paid_paisa = int(payment.get("amountPaidPaisa", 0) or 0)
        if not paid_paisa:
            paid_paisa = int(round(float(payment.get("amountRupees", 0) or 0) * 100))
        rows.append(
            [
                payment.get("month", ""),
                str(paid_paisa),
                payment.get("method", ""),
                payment.get("paidAt", ""),
            ]
        )
    table = Table(rows, colWidths=[90, 130, 100, 130])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#43A047")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
            ]
        )
    )
    story.append(table)
    doc = SimpleDocTemplate(path, pagesize=A4)
    doc.build(story)
    return path


def build_policy_certificate_pdf(policy: dict) -> str:
    path = f"/tmp/policy_certificate_{policy['id']}_{uuid.uuid4().hex[:8]}.pdf"
    if HINDI_FONT != "Helvetica":
        heading = "फसल बीमा प्रमाणपत्र (PMFBY)"
    else:
        heading = "Crop Insurance Certificate (PMFBY)"
    heading_style = ParagraphStyle(
        "CertTitle", fontName=HINDI_FONT, fontSize=18, spaceAfter=16
    )
    styles = getSampleStyleSheet()
    story = [
        Paragraph(heading, heading_style),
        Paragraph(f"Generated on: {datetime.now(timezone.utc).date().isoformat()}", styles["Normal"]),
        Spacer(1, 12),
    ]
    rows = [
        ["Policy Number", policy.get("policyNumber", "")],
        ["Scheme", policy.get("schemeName", "")],
        ["Crop", f"{policy.get('cropName', '')} ({policy.get('season', '')} {policy.get('year', '')})"],
        ["Land Area (acres)", str(policy.get("landAreaAcres", ""))],
        ["Sum Insured", f"Rs {policy.get('sumInsured', 0)}"],
        ["Farmer Premium", f"Rs {policy.get('farmerPremium', 0)}"],
        ["Govt Subsidy", f"Rs {policy.get('govtSubsidy', 0)}"],
        ["Validity", f"{policy.get('coverageStartDate', '')} to {policy.get('coverageEndDate', '')}"],
        ["Insurer", policy.get("insuranceCompany", "")],
    ]
    table = Table(rows, colWidths=[140, 300])
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ]
        )
    )
    story.append(table)
    doc = SimpleDocTemplate(path, pagesize=A4)
    doc.build(story)
    return path


def upload_to_storage(local_path: str, dest_path: str) -> str:
    if settings.env == "dev":
        logger.warning("dev mode: skipping Firebase Storage upload for %s", dest_path)
        return f"file://{local_path}"
    import firebase_admin.storage

    bucket = firebase_admin.storage.bucket()
    blob = bucket.blob(dest_path)
    blob.upload_from_filename(local_path)
    blob.make_public()
    return blob.public_url
