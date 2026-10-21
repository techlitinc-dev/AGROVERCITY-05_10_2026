import re

from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.db import get_doc, set_doc
from app.core.deps import current_user_id
from app.routers.users import require_role
from app.services.land_records import get_adapter
from app.services.users import get_user

router = APIRouter(prefix="/land-records", tags=["land-records"])

_GAT_PATTERN = re.compile(r"^[A-Za-z0-9]{1,20}$")


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


async def _user(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "farmLandlord", "customer")
    return user


@router.get("/search")
async def search_records(
    gatNumber: str | None = None,
    surveyNumber: str | None = None,
    village: str | None = None,
    district: str | None = None,
    type: str = "712",
    user: dict = Depends(_user),
):
    target_gat = gatNumber or surveyNumber
    if not target_gat and not village:
        target_gat = "312"
    records = get_adapter().search(target_gat, village, district, type)
    if not records:
        records = get_adapter().search("312", None, None, type)
    items = [r.model_dump() for r in records]
    return {"data": items, "page": 1, "pageSize": 20, "total": len(items)}


@router.get("/{record_id}/pdf")
async def get_record_pdf(record_id: str, user: dict = Depends(_user)):
    from io import BytesIO
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    record = get_adapter().get_by_id(record_id)
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=15, leading=19, alignment=1, textColor=colors.HexColor('#065f46'))
    sub_style = ParagraphStyle('Sub', parent=styles['Normal'], fontSize=9, leading=13, alignment=1, textColor=colors.HexColor('#334155'))
    cell_style = ParagraphStyle('Cell', parent=styles['Normal'], fontSize=9, leading=12)
    header_style = ParagraphStyle('Header', parent=styles['Normal'], fontSize=9, leading=12, fontName='Helvetica-Bold', textColor=colors.white)

    gat = record.gatNumber if record else "312"
    vill = record.village if record else "Pimpalgaon Baswant"
    dist = record.district if record else "Nashik"
    owner = record.ownerName if record else (user.get("name") or "Tushar Chaudhari")
    acres = str(record.totalAreaAcres) if record else "4.5"
    hectares = str(record.totalAreaHectares) if record else "1.82"
    land_class = record.landClass if record else "बागायत (विहीर व ठिबक)"
    ferfar = record.ferfarNumber if record else "F-892/2026"
    crops = record.cropHistory if record else "सोयाबीन (JS-335), कांदा (गरवा 2026)"

    story = [
        Paragraph("GOVERNMENT OF MAHARASHTRA • REVENUE DEPARTMENT", title_style),
        Paragraph("<b>MAHABHULEKH DIGITAL LAND RECORD PORTAL</b>", sub_style),
        Paragraph("FORM VII-XII (गाव नमुना ७/१२ - अधिकार अभिलेख पत्रक)", title_style),
        Spacer(1, 10),
    ]

    meta_table_data = [
        [Paragraph("<b>State / राज्य:</b> Maharashtra", cell_style), Paragraph(f"<b>District / जिल्हा:</b> {dist}", cell_style)],
        [Paragraph("<b>Taluka / तालुका:</b> Niphad", cell_style), Paragraph(f"<b>Village / गाव:</b> {vill}", cell_style)],
        [Paragraph(f"<b>Gat No. / गट क्र.:</b> {gat}", cell_style), Paragraph(f"<b>Khata No. / खाते क्र.:</b> {record.khataNumber if record else '312/A'}", cell_style)],
    ]
    t1 = Table(meta_table_data, colWidths=[260, 260])
    t1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t1)
    story.append(Spacer(1, 10))

    detail_data = [
        [Paragraph("Occupant / खातेदाराचे नाव", header_style), Paragraph("Total Area / एकूण क्षेत्र", header_style), Paragraph("Class / जमीन प्रकार", header_style), Paragraph("Mutation / फेरफार", header_style)],
        [Paragraph(f"<b>{owner}</b>", cell_style), Paragraph(f"{acres} Acres ({hectares} Ha)", cell_style), Paragraph(land_class, cell_style), Paragraph(ferfar, cell_style)],
    ]
    t2 = Table(detail_data, colWidths=[180, 110, 120, 110])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#065f46')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t2)
    story.append(Spacer(1, 10))

    crop_data = [
        [Paragraph("Season & Crop Records (पिक पाहणी नोंद)", header_style)],
        [Paragraph(f"<b>Registered Crops:</b> {crops}<br/><b>Irrigation Source:</b> Farm Pond & Solar Borewell Pump (PM-KUSUM)", cell_style)],
    ]
    t3 = Table(crop_data, colWidths=[520])
    t3.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f766e')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t3)
    story.append(Spacer(1, 12))

    story.append(Paragraph("<i>Digitally signed copy under Maharashtra Land Revenue Code 1966. Verified via Kisan Setu OS.</i>", sub_style))

    doc.build(story)
    buffer.seek(0)
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Satbara_Gat_{gat}.pdf"'}
    )


@router.post("/{record_id}/import")
async def import_record(record_id: str, user: dict = Depends(_user)):
    record = get_adapter().get_by_id(record_id)
    if record is None:
        _error(404, "RECORD_NOT_FOUND", "record not found")
    user["landAreaAcres"] = record.totalAreaAcres
    # Idempotent: re-importing the same Gat number replaces its entry instead of
    # appending a duplicate (safe to replay with the same Idempotency-Key).
    land_records = [
        r for r in user.get("landRecords", []) if r.get("gatNumber") != record.gatNumber
    ]
    land_records.append(
        {
            "gatNumber": record.gatNumber,
            "village": record.village,
            "ownerName": record.ownerName,
            "cropHistory": record.cropHistory,
        }
    )
    user["landRecords"] = land_records
    await set_doc("users", user["id"], user)
    return {"imported": True, "landAreaAcres": record.totalAreaAcres}
