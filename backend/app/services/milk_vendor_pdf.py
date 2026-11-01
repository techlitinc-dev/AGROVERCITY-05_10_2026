"""Milk vendor bill PDF renderer (reportlab → bytes).

The PDF is built strictly from the immutable bill snapshot plus the vendor's
public business details and the client's display name/area — never database
ids, KYC data, internal notes, or share tokens.
"""

import io
import uuid

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

GREEN = colors.HexColor("#065f46")
LIGHT = colors.HexColor("#ecfdf5")
GRID = colors.HexColor("#cbd5e1")


def product_names_for(products: list[dict]) -> dict[str, str]:
    return {p["id"]: p.get("name") or "Milk" for p in products}


def _money(paisa: int) -> str:
    return f"Rs {(paisa or 0) / 100:,.2f}"


def _qty(quantity_ml: int) -> str:
    ml = quantity_ml or 0
    if ml % 1000 == 0:
        return f"{ml // 1000} L"
    return f"{ml / 1000:.3f} L"


def render_bill_pdf(bill: dict, profile: dict, client: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title=f"Milk bill {bill.get('billNumber', '')}",
    )
    title = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=16, textColor=GREEN, spaceAfter=2)
    sub = ParagraphStyle("sub", fontName="Helvetica", fontSize=9, textColor=colors.HexColor("#475569"))
    section = ParagraphStyle("section", fontName="Helvetica-Bold", fontSize=10, textColor=GREEN, spaceBefore=10, spaceAfter=4)
    normal = ParagraphStyle("normal", fontName="Helvetica", fontSize=9, textColor=colors.HexColor("#0f172a"))
    small = ParagraphStyle("small", fontName="Helvetica", fontSize=8, textColor=colors.HexColor("#475569"))

    story = []
    story.append(Paragraph(profile.get("businessName") or profile.get("displayName") or "Milk Vendor", title))
    vendor_lines = [l for l in [profile.get("address"), profile.get("phone")] if l]
    if vendor_lines:
        story.append(Paragraph(" · ".join(vendor_lines), sub))
    story.append(Spacer(1, 8))

    revision = int(bill.get("revisionNumber") or 1)
    meta = [
        ["Bill No:", str(bill.get("billNumber", "")) + (f" (rev {revision})" if revision > 1 else ""), "Bill date:", str(bill.get("generatedAt", ""))[:10]],
        ["Customer:", str(client.get("name", "")), "Period:", f"{bill.get('periodStart')} to {bill.get('periodEnd')}"],
    ]
    if client.get("area"):
        meta.append(["Area:", str(client.get("area")), "", ""])
    meta_table = Table(meta, colWidths=[22 * mm, 78 * mm, 18 * mm, 60 * mm])
    meta_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(meta_table)
    story.append(Spacer(1, 6))

    story.append(Paragraph("Delivery details", section))
    rows = [["Date", "Shift", "Product", "Qty", "Rate/L", "Amount"]]
    for item in bill.get("lineItems") or []:
        rows.append(
            [
                str(item.get("deliveryDate", "")),
                str(item.get("shift", "")).capitalize(),
                str(item.get("productName", "")),
                _qty(int(item.get("quantityMilliLitres") or 0)),
                _money(int(item.get("appliedRatePaisaPerUnit") or 0)),
                _money(int(item.get("amountPaisa") or 0)),
            ]
        )
    items_table = Table(rows, colWidths=[24 * mm, 18 * mm, 40 * mm, 22 * mm, 26 * mm, 30 * mm], repeatRows=1)
    items_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), GREEN),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("GRID", (0, 0), (-1, -1), 0.4, GRID),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
                ("ALIGN", (3, 1), (-1, -1), "RIGHT"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    if len(rows) > 1:
        story.append(items_table)
    else:
        story.append(Paragraph("No deliveries in this period.", normal))

    totals = [
        ["Delivery total", _money(int(bill.get("deliveryTotalPaisa") or 0))],
        ["Adjustments", _money(int(bill.get("adjustmentsPaisa") or 0))],
        ["Bill amount", _money(int(bill.get("grossTotalPaisa") or 0))],
    ]
    if int(bill.get("openingBalancePaisa") or 0):
        totals.append(["Opening balance", _money(int(bill.get("openingBalancePaisa") or 0))])
    totals.append(["Payments recorded", "- " + _money(int(bill.get("paymentsAppliedPaisa") or 0))])
    totals.append(["Balance due", _money(int(bill.get("balancePaisa") or 0))])
    totals_table = Table(totals, colWidths=[120 * mm, 40 * mm], hAlign="RIGHT")
    style_cmds = [
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEABOVE", (0, 2), (-1, 2), 0.5, GRID),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, -1), (-1, -1), LIGHT),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    if int(bill.get("openingBalancePaisa") or 0):
        style_cmds.append(("FONTNAME", (0, 3), (-1, 3), "Helvetica"))
    totals_table.setStyle(TableStyle(style_cmds))
    story.append(Spacer(1, 8))
    story.append(totals_table)

    instructions = bill.get("paymentInstructionsSnapshot") or ""
    if instructions:
        story.append(Paragraph("Payment instructions", section))
        story.append(Paragraph(str(instructions).replace("\n", "<br/>"), normal))
    if bill.get("upiIdSnapshot"):
        story.append(Paragraph(f"UPI: {bill['upiIdSnapshot']}", normal))
    if bill.get("notesSnapshot"):
        story.append(Paragraph(f"Note: {bill['notesSnapshot']}", small))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Payments are made directly to the vendor. This bill was generated electronically.", small))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


def bill_pdf_path(vendor_id: str, bill_id: str) -> str:
    return f"milk_bills/{vendor_id}/{bill_id}_{uuid.uuid4().hex[:8]}.pdf"
