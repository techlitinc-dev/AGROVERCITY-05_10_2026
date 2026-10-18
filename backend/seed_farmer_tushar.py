import asyncio
import os
import uuid
from datetime import datetime, timezone, timedelta

from app.core.db import get_db, get_doc, set_doc, query

UID = "EWYuwJIr5JMPbFajKE9AclBpWnf2"

async def seed():
    print(f"Seeding comprehensive live data for Farmer Tushar Chaudhari (UID: {UID})...")
    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    yesterday_iso = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    three_days_ago_iso = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    five_days_ago_iso = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    tomorrow_iso = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

    # 1. Update User Profile
    user = await get_doc("users", UID) or {"id": UID}
    user.update({
        "name": "Tushar Chaudhari",
        "phone": "+919975721517",
        "email": "techlitinc@gmail.com",
        "district": "Nashik",
        "tehsil": "Niphad",
        "village": "Pimpalgaon Baswant",
        "gatNumber": "312",
        "surveyNumber": "312",
        "pincode": "422006",
        "state": "Maharashtra",
        "addressLine": "Gat No. 312, Pimpalgaon Baswant, Taluka Niphad, District Nashik - 422006",
        "activeProfile": "farmer",
        "primaryProfile": "farmer",
        "linkedProfiles": ["farmer", "seller", "broker", "directBuyer", "transporter"],
        "kccLimit": 150000,
        "kisanCreditScore": 742,
        "creditTier": "Gold",
        "bankName": "State Bank of India",
        "soilType": "Medium Black (काळी जमीन)",
        "irrigationType": "Drip Irrigation (ठिबक सिंचन)",
        "activeCrops": ["Soybean (JS 335)", "Onion (Garwa)", "Wheat (Lokwan)"],
        "farmBoundaryPoints": [
            {"lat": 20.1742, "lng": 73.9851},
            {"lat": 20.1755, "lng": 73.9872},
            {"lat": 20.1738, "lng": 73.9880},
            {"lat": 20.1725, "lng": 73.9860}
        ],
        "landAreaAcres": 4.5,
        "agriCoins": 350,
        "krishiRatnaLevel": 2,
        "krishiRatnaTitle": "Krishi Pragati (प्रगतिशील शेतकरी)",
        "streakDays": 14,
        "kycStatus": "verified"
    })
    await set_doc("users", UID, user)
    print("✓ Updated user profile in Firestore")

    # 2. Institutional Buyer Demands (6 Demands)
    demands_data = [
        {
            "id": "dem_itc_soybean_01",
            "buyerId": "buyer_itc_choupal",
            "buyerName": "ITC e-Choupal Procurement",
            "buyerCompany": "ITC Limited - Agri Business Division",
            "crop": "Soybean (JS 335)",
            "variety": "JS 335 / Yellow Food Grade",
            "quantity": 500.0,
            "unit": "quintal",
            "targetPrice": 4950,
            "expectedPricePerUnit": 4950,
            "minQuantity": 20.0,
            "maxQuantity": 500.0,
            "qualityGrade": "Grade A (Moisture < 10%, Foreign Matter < 1%)",
            "deliveryLocation": "ITC e-Choupal Hub, Pimpalgaon Baswant, Nashik",
            "state": "Maharashtra",
            "district": "Nashik",
            "status": "open",
            "offersCount": 3,
            "paymentTerms": "Instant Escrow release upon weighbridge slip verification",
            "validUntil": tomorrow_iso,
            "createdAt": yesterday_iso,
            "updatedAt": now_iso
        },
        {
            "id": "dem_mother_dairy_onion_02",
            "buyerId": "buyer_mother_dairy",
            "buyerName": "Mother Dairy Safal Procurement",
            "buyerCompany": "Mother Dairy Fruit & Vegetable Pvt Ltd",
            "crop": "Onion (Garwa)",
            "variety": "Nashik Red Garwa (55mm+ Size)",
            "quantity": 350.0,
            "unit": "quintal",
            "targetPrice": 2850,
            "expectedPricePerUnit": 2850,
            "minQuantity": 25.0,
            "maxQuantity": 350.0,
            "qualityGrade": "Grade A Export / Sorting Standard",
            "deliveryLocation": "Safal Cold Storage Collection Hub, Pimpalgaon",
            "state": "Maharashtra",
            "district": "Nashik",
            "status": "open",
            "offersCount": 5,
            "paymentTerms": "Same-day NEFT payout via Agrovercity Escrow",
            "validUntil": tomorrow_iso,
            "createdAt": yesterday_iso,
            "updatedAt": now_iso
        },
        {
            "id": "dem_reliance_wheat_03",
            "buyerId": "buyer_reliance_fresh",
            "buyerName": "Reliance Fresh Sourcing",
            "buyerCompany": "Reliance Retail Agri Sourcing Ltd",
            "crop": "Wheat (Lokwan)",
            "variety": "Lokwan Premium Sharbati Grain",
            "quantity": 250.0,
            "unit": "quintal",
            "targetPrice": 3100,
            "expectedPricePerUnit": 3100,
            "minQuantity": 15.0,
            "maxQuantity": 250.0,
            "qualityGrade": "Milling Grade 1 (Luster clean, Dry)",
            "deliveryLocation": "Reliance Fresh Central Distribution Center, Nashik",
            "state": "Maharashtra",
            "district": "Nashik",
            "status": "open",
            "offersCount": 2,
            "paymentTerms": "T+1 direct bank transfer",
            "validUntil": tomorrow_iso,
            "createdAt": three_days_ago_iso,
            "updatedAt": now_iso
        },
        {
            "id": "dem_adani_soybean_04",
            "buyerId": "buyer_adani_wilmar",
            "buyerName": "Adani Wilmar Fortune Sourcing",
            "buyerCompany": "Adani Wilmar Agro Industries",
            "crop": "Soybean (JS 335)",
            "variety": "High Oil Content Yellow Soybean",
            "quantity": 800.0,
            "unit": "quintal",
            "targetPrice": 4920,
            "expectedPricePerUnit": 4920,
            "minQuantity": 50.0,
            "maxQuantity": 800.0,
            "qualityGrade": "Industrial Crushing Grade (Oil > 19%)",
            "deliveryLocation": "Adani Agro Logistics Terminal, Dindori, Nashik",
            "state": "Maharashtra",
            "district": "Nashik",
            "status": "open",
            "offersCount": 4,
            "paymentTerms": "Immediate Escrow release upon lab assay",
            "validUntil": tomorrow_iso,
            "createdAt": three_days_ago_iso,
            "updatedAt": now_iso
        },
        {
            "id": "dem_tata_onion_05",
            "buyerId": "buyer_tata_sampann",
            "buyerName": "Tata Sampann Quality Sourcing",
            "buyerCompany": "Tata Consumer Products Limited",
            "crop": "Onion (Garwa)",
            "variety": "Export Quality Medium Onion",
            "quantity": 400.0,
            "unit": "quintal",
            "targetPrice": 2900,
            "expectedPricePerUnit": 2900,
            "minQuantity": 30.0,
            "maxQuantity": 400.0,
            "qualityGrade": "Global GAP Certified / Residue Free",
            "deliveryLocation": "Tata Sampann Packhouse, Lasalgaon Road, Nashik",
            "state": "Maharashtra",
            "district": "Nashik",
            "status": "open",
            "offersCount": 1,
            "paymentTerms": "24-hr IMPS Settlement",
            "validUntil": tomorrow_iso,
            "createdAt": five_days_ago_iso,
            "updatedAt": now_iso
        },
        {
            "id": "dem_patanjali_wheat_06",
            "buyerId": "buyer_patanjali_ayur",
            "buyerName": "Patanjali Organic Foods",
            "buyerCompany": "Patanjali Foods Limited",
            "crop": "Wheat (Lokwan)",
            "variety": "Bio-Natural Desi Lokwan",
            "quantity": 150.0,
            "unit": "quintal",
            "targetPrice": 3450,
            "expectedPricePerUnit": 3450,
            "minQuantity": 10.0,
            "maxQuantity": 150.0,
            "qualityGrade": "Organic Certified Soil Produce",
            "deliveryLocation": "Patanjali Processing Cluster, Sinnar, Nashik",
            "state": "Maharashtra",
            "district": "Nashik",
            "status": "open",
            "offersCount": 3,
            "paymentTerms": "Direct KCC Bank Transfer",
            "validUntil": tomorrow_iso,
            "createdAt": five_days_ago_iso,
            "updatedAt": now_iso
        }
    ]
    for d in demands_data:
        await set_doc("demands", d["id"], d)
    print(f"✓ Seeded {len(demands_data)} institutional buyer demands in Firestore")

    # 3. Live Purchases / Bookings for Tushar Chaudhari (3 Purchases)
    purchases_data = [
        {
            "id": "pur_itc_soy_9812",
            "buyerId": "buyer_itc_choupal",
            "buyerName": "ITC e-Choupal Procurement",
            "farmerId": UID,
            "farmerName": "Tushar Chaudhari",
            "source": {"type": "lot", "refId": "lot_soybean_312"},
            "crop": "Soybean (JS 335)",
            "variety": "JS 335 Grade A",
            "quantity": 40.0,
            "unit": "quintal",
            "agreedPricePerUnit": 4950,
            "totalAmount": 198000,
            "advancePaid": 50000,
            "status": "pickupScheduled",
            "pickup": {
                "scheduledDate": tomorrow_iso[:10],
                "timeSlot": "10:30 AM – 1:00 PM",
                "vehicleNumber": "MH-15-EG-4912 (Eicher 14ft Pro 2049)",
                "driverName": "Ganesh Shinde",
                "driverPhone": "+919822049182",
                "farmLocation": "Gat No. 312, Pimpalgaon Baswant"
            },
            "handover": {
                "otp": "742918",
                "attempts": 0,
                "verified": False,
                "expiresAt": tomorrow_iso
            },
            "escrow": {
                "status": "funded",
                "amount": 198000,
                "escrowId": "esc_itc_198000"
            },
            "qc": {
                "moisturePercent": 9.4,
                "foreignMatterPercent": 0.8,
                "grade": "Grade A",
                "inspector": "ITC Quality Lab Assayer"
            },
            "events": [
                {"status": "confirmed", "at": three_days_ago_iso, "by": "buyer_itc_choupal"},
                {"status": "advancePaid", "at": yesterday_iso, "by": "buyer_itc_choupal", "amount": 50000},
                {"status": "pickupScheduled", "at": now_iso, "by": "buyer_itc_choupal"}
            ],
            "payments": [
                {"id": "pay_adv_50k", "kind": "advance", "amount": 50000, "status": "settled", "at": yesterday_iso}
            ],
            "rating": {"buyerToFarmer": None, "farmerToBuyer": None},
            "createdAt": three_days_ago_iso,
            "updatedAt": now_iso
        },
        {
            "id": "pur_motherdairy_onion_8721",
            "buyerId": "buyer_mother_dairy",
            "buyerName": "Mother Dairy Safal Procurement",
            "farmerId": UID,
            "farmerName": "Tushar Chaudhari",
            "source": {"type": "lot", "refId": "lot_onion_312"},
            "crop": "Onion (Garwa)",
            "variety": "Nashik Red Garwa",
            "quantity": 50.0,
            "unit": "quintal",
            "agreedPricePerUnit": 2850,
            "totalAmount": 142500,
            "advancePaid": 35000,
            "status": "inTransit",
            "pickup": {
                "scheduledDate": yesterday_iso[:10],
                "timeSlot": "8:00 AM",
                "vehicleNumber": "MH-15-BH-7744 (Tata 407)",
                "driverName": "Sanjay Wagh",
                "driverPhone": "+919763118844",
                "farmLocation": "Gat No. 312, Pimpalgaon Baswant"
            },
            "handover": {
                "otp": "518320",
                "attempts": 1,
                "verified": True,
                "verifiedAt": yesterday_iso
            },
            "escrow": {
                "status": "funded",
                "amount": 142500,
                "escrowId": "esc_safal_142500"
            },
            "qc": {
                "sizeMm": 58,
                "rotPercent": 0.0,
                "grade": "Grade A Export",
                "inspector": "Safal Agri QC Inspector"
            },
            "events": [
                {"status": "confirmed", "at": five_days_ago_iso, "by": "buyer_mother_dairy"},
                {"status": "advancePaid", "at": three_days_ago_iso, "by": "buyer_mother_dairy", "amount": 35000},
                {"status": "pickupScheduled", "at": three_days_ago_iso, "by": "buyer_mother_dairy"},
                {"status": "inTransit", "at": yesterday_iso, "by": "MH-15-BH-7744"}
            ],
            "payments": [
                {"id": "pay_adv_35k", "kind": "advance", "amount": 35000, "status": "settled", "at": three_days_ago_iso}
            ],
            "rating": {"buyerToFarmer": None, "farmerToBuyer": None},
            "createdAt": five_days_ago_iso,
            "updatedAt": now_iso
        },
        {
            "id": "pur_reliance_wheat_7612",
            "buyerId": "buyer_reliance_fresh",
            "buyerName": "Reliance Fresh Sourcing",
            "farmerId": UID,
            "farmerName": "Tushar Chaudhari",
            "source": {"type": "lot", "refId": "lot_wheat_312"},
            "crop": "Wheat (Lokwan)",
            "variety": "Lokwan Sharbati",
            "quantity": 30.0,
            "unit": "quintal",
            "agreedPricePerUnit": 3100,
            "totalAmount": 93000,
            "finalAmount": 93000,
            "advancePaid": 93000,
            "status": "completed",
            "pickup": {
                "scheduledDate": five_days_ago_iso[:10],
                "timeSlot": "9:00 AM",
                "vehicleNumber": "MH-15-DC-3301",
                "driverName": "Dilip Pawar",
                "driverPhone": "+919890234511",
                "farmLocation": "Gat No. 312, Pimpalgaon Baswant"
            },
            "handover": {
                "otp": "882109",
                "attempts": 1,
                "verified": True,
                "verifiedAt": five_days_ago_iso
            },
            "escrow": {
                "status": "released",
                "amount": 93000,
                "escrowId": "esc_rel_93000"
            },
            "qc": {
                "grade": "Grade 1 Sharbati",
                "cleanlinessPercent": 99.2,
                "inspector": "Reliance Central QC"
            },
            "events": [
                {"status": "confirmed", "at": five_days_ago_iso, "by": "buyer_reliance_fresh"},
                {"status": "advancePaid", "at": five_days_ago_iso, "by": "buyer_reliance_fresh", "amount": 93000},
                {"status": "inTransit", "at": five_days_ago_iso, "by": "MH-15-DC-3301"},
                {"status": "delivered", "at": five_days_ago_iso, "by": "MH-15-DC-3301"},
                {"status": "completed", "at": five_days_ago_iso, "by": "buyer_reliance_fresh"}
            ],
            "payments": [
                {"id": "pay_full_93k", "kind": "final", "amount": 93000, "status": "settled", "at": five_days_ago_iso}
            ],
            "rating": {"buyerToFarmer": 5, "farmerToBuyer": 5},
            "createdAt": five_days_ago_iso,
            "updatedAt": five_days_ago_iso
        }
    ]
    for p in purchases_data:
        await set_doc("purchases", p["id"], p)
    print(f"✓ Seeded {len(purchases_data)} live purchases for Tushar Chaudhari in Firestore")

    # 4. Bank Account
    bank_acc = {
        "id": "bank_sbi_30872619482",
        "accountHolder": "Tushar Chaudhari",
        "accountNumber": "30872619482",
        "ifsc": "SBIN0000437",
        "bankName": "State Bank of India - Pimpalgaon Baswant",
        "branch": "Pimpalgaon Baswant, Nashik",
        "isPrimary": True,
        "verifyStatus": "verified",
        "createdAt": "2026-01-10T08:00:00Z"
    }
    await set_doc(f"users/{UID}/bank_accounts", bank_acc["id"], bank_acc)
    print("✓ Seeded verified primary bank account in Firestore")

    # 5. Active KCC Loan Application
    loan_app = {
        "id": "kcc_sbi_loan_312",
        "userId": UID,
        "farmerName": "Tushar Chaudhari",
        "farmerPhone": "+919975721517",
        "farmerCreditScore": 742,
        "farmerCreditTier": "Gold",
        "applicationNumber": "KCC-2026-MH-0842",
        "loanType": "Kisan Credit Card (KCC)",
        "amountRequested": 150000,
        "amountApproved": 150000,
        "tenureMonths": 12,
        "interestRate": 4.0,
        "interestSubventionPercent": 3.0,
        "bankName": "State Bank of India",
        "bankAccountId": bank_acc["id"],
        "bankAccountLast4": "9482",
        "bankIfsc": "SBIN0000437",
        "landRecordId": "712_MH_NSK_312",
        "gatNumber": "312",
        "village": "Pimpalgaon Baswant",
        "status": "disbursed",
        "statusText": "ऋण स्वीकृत एवं बैंक खाते में जमा (Disbursed)",
        "disbursedAmount": 150000,
        "disbursedAt": yesterday_iso,
        "documents": [
            {"id": "doc_712", "type": "712_extract", "name": "7-12_Gat_312.pdf", "verified": True},
            {"id": "doc_aadhaar", "type": "aadhaar", "name": "Aadhaar_Masked.pdf", "verified": True}
        ],
        "timeline": [
            {"status": "submitted", "statusText": "आवेदन जमा किया (Submitted)", "at": five_days_ago_iso, "by": UID},
            {"status": "approved", "statusText": "बैंक प्रबंधक द्वारा स्वीकृत (Approved)", "at": three_days_ago_iso, "by": "banker_sbi_nsk"},
            {"status": "disbursed", "statusText": "खाते में राशि अंतरित (Disbursed)", "at": yesterday_iso, "by": "banker_sbi_nsk"}
        ],
        "createdAt": five_days_ago_iso,
        "updatedAt": yesterday_iso
    }
    await set_doc("loan_applications", loan_app["id"], loan_app)
    print("✓ Seeded active KCC loan application in Firestore")

    # 6. Vault Documents
    vault_docs = [
        {
            "id": "vault_712_312",
            "docType": "712",
            "fileName": "7_12_Extract_Gat_312_Pimpalgaon.pdf",
            "blobPath": f"vault/{UID}/712_312.pdf",
            "uploadedAt": five_days_ago_iso,
            "sizeBytes": 142800,
            "status": "verified"
        },
        {
            "id": "vault_soil_card",
            "docType": "soilHealthCard",
            "fileName": "Soil_Health_Card_ICAR_2026.pdf",
            "blobPath": f"vault/{UID}/soil_card.pdf",
            "uploadedAt": three_days_ago_iso,
            "sizeBytes": 98400,
            "status": "verified"
        },
        {
            "id": "vault_aadhaar",
            "docType": "aadhaar",
            "fileName": "Aadhaar_Card_Masked.pdf",
            "blobPath": f"vault/{UID}/aadhaar.pdf",
            "uploadedAt": five_days_ago_iso,
            "sizeBytes": 85100,
            "status": "verified"
        },
        {
            "id": "vault_passbook",
            "docType": "bankPassbook",
            "fileName": "SBI_Bank_Passbook_Front.jpg",
            "blobPath": f"vault/{UID}/passbook.jpg",
            "uploadedAt": five_days_ago_iso,
            "sizeBytes": 210400,
            "status": "verified"
        }
    ]
    for vd in vault_docs:
        await set_doc(f"users/{UID}/vault_documents", vd["id"], vd)
    print(f"✓ Seeded {len(vault_docs)} verified vault documents in Firestore")

    # 7. Farm Diary Entries (Cashbook & P&L Engine)
    diary_entries = [
        {
            "id": "diary_inc_01",
            "type": "income",
            "category": "produce_sales",
            "crop": "Wheat (Lokwan)",
            "description": "Reliance Fresh Sourcing - 30 Quintal Lokwan Wheat Full Payout",
            "amountRupees": 93000,
            "quantityQuintals": 30.0,
            "date": five_days_ago_iso[:10],
            "buyer": "Reliance Fresh Sourcing",
            "paymentMode": "Direct Bank NEFT",
            "notes": "Delivered to Lasalgaon Hub, Grade 1 verified",
            "createdAt": five_days_ago_iso,
            "updatedAt": five_days_ago_iso
        },
        {
            "id": "diary_inc_02",
            "type": "income",
            "category": "advance_payment",
            "crop": "Soybean (JS 335)",
            "description": "ITC e-Choupal Contract Advance Payment for 40 Quintals",
            "amountRupees": 50000,
            "quantityQuintals": 40.0,
            "date": yesterday_iso[:10],
            "buyer": "ITC e-Choupal Procurement",
            "paymentMode": "Agrovercity Escrow",
            "notes": "Pickup scheduled tomorrow 10:30 AM",
            "createdAt": yesterday_iso,
            "updatedAt": yesterday_iso
        },
        {
            "id": "diary_inc_03",
            "type": "income",
            "category": "advance_payment",
            "crop": "Onion (Garwa)",
            "description": "Mother Dairy Safal Advance Payment for 50 Quintals",
            "amountRupees": 35000,
            "quantityQuintals": 50.0,
            "date": three_days_ago_iso[:10],
            "buyer": "Mother Dairy Safal Procurement",
            "paymentMode": "Agrovercity Escrow",
            "notes": "Vehicle MH-15-BH-7744 in transit to Safal Cold Storage",
            "createdAt": three_days_ago_iso,
            "updatedAt": three_days_ago_iso
        },
        {
            "id": "diary_exp_01",
            "type": "expense",
            "category": "fertilizers",
            "crop": "Soybean (JS 335)",
            "description": "IFFCO DAP 5 Bags & Urea 3 Bags for Top-Dressing",
            "amountRupees": 14200,
            "vendor": "IFFCO Kisan Seva Kendra, Pimpalgaon",
            "date": five_days_ago_iso[:10],
            "paymentMode": "UPI",
            "notes": "Applied with balanced NPK prescription (20:60:40)",
            "createdAt": five_days_ago_iso,
            "updatedAt": five_days_ago_iso
        },
        {
            "id": "diary_exp_02",
            "type": "expense",
            "category": "fuel_diesel",
            "crop": "Soybean (JS 335)",
            "description": "Mahindra 575 DI Tractor Diesel (52 Liters @ ₹92.3/L)",
            "amountRupees": 4800,
            "vendor": "Indian Oil Petrol Pump, Pimpalgaon",
            "date": three_days_ago_iso[:10],
            "paymentMode": "Cash",
            "notes": "Field rotavation & secondary tilling for Gat No. 312",
            "createdAt": three_days_ago_iso,
            "updatedAt": three_days_ago_iso
        },
        {
            "id": "diary_exp_03",
            "type": "expense",
            "category": "labor",
            "crop": "Onion (Garwa)",
            "description": "Labor charges for Onion sorting, grading, and gunny packing (6 workers)",
            "amountRupees": 12000,
            "vendor": "Local Mukadam Team",
            "date": yesterday_iso[:10],
            "paymentMode": "Cash",
            "notes": "Packed 50kg export net bags for Safal truck",
            "createdAt": yesterday_iso,
            "updatedAt": yesterday_iso
        },
        {
            "id": "diary_exp_04",
            "type": "expense",
            "category": "irrigation_equipment",
            "crop": "Onion (Garwa)",
            "description": "Jain Drip Inline Laterals & Venturi Injector Replacement",
            "amountRupees": 6500,
            "vendor": "Jain Irrigation Authorized Dealer, Nashik",
            "date": three_days_ago_iso,
            "paymentMode": "UPI",
            "notes": "Subsurface drip line flushed and pressure regulated",
            "createdAt": three_days_ago_iso,
            "updatedAt": three_days_ago_iso
        }
    ]
    for de in diary_entries:
        await set_doc(f"users/{UID}/diary_entries", de["id"], de)
    print(f"✓ Seeded {len(diary_entries)} real cashbook/P&L diary entries in Firestore")

    # 8. PMFBY Crop Insurance Policy
    policy_doc = {
        "id": "pmfby_kharif_soy_312",
        "policyNumber": "PMFBY-2026-MH-NSK-0812",
        "schemeName": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
        "userId": UID,
        "cropName": "Soybean (JS 335)",
        "season": "Kharif 2026",
        "landAreaAcres": 4.5,
        "gatNumber": "312",
        "village": "Pimpalgaon Baswant",
        "district": "Nashik",
        "state": "Maharashtra",
        "sumInsured": 180000,
        "totalPremium": 18000,
        "farmerPremium": 3600,
        "govtSubsidy": 14400,
        "farmerSharePercent": 2.0,
        "status": "active",
        "coverageStartDate": "2026-06-15",
        "coverageEndDate": "2026-11-30",
        "insuranceProvider": "Agriculture Insurance Company of India (AIC)",
        "createdAt": "2026-06-10T10:00:00Z"
    }
    await set_doc(f"users/{UID}/insurance_policies", policy_doc["id"], policy_doc)
    await set_doc("insurance_policies", policy_doc["id"], policy_doc)
    print("✓ Seeded active PMFBY crop insurance policy in Firestore")

    # 9. Disease Scans
    scan_doc = {
        "scan_id": "scan_soybean_rust_312",
        "farmerId": UID,
        "plotId": "Gat_312_South_Plot",
        "photo_url": "https://images.unsplash.com/photo-1592417817098-8f3d6ef23a49?w=800&auto=format&fit=crop",
        "diagnosis": {
            "diseaseName": "Asian Soybean Rust / तांबेरा रोग",
            "crop": "Soybean (JS 335)",
            "pathogen": "Phakopsora pachyrhizi",
            "confidence": 0.94,
            "symptoms": "पत्तियों की निचली सतह पर छोटे भूरे-लाल धब्बे (pustules), पत्तियां पीली पड़कर समय से पहले गिरना। Early defoliation observed under humid weather.",
            "chemicalTreatment": "Tebuconazole 25.9% EC @ 1.0 ml/L or Hexaconazole 5% SC @ 2.0 ml/L",
            "organicTreatment": "Trichoderma viride @ 5 g/L + 5% नीम अर्क (Dashparni Ark) का छिड़काव",
            "dosage": "1.0 to 1.5 ml/L of clean water with wetting agent (sticking agent)",
            "estimatedCost": 480.0
        },
        "confidence": 0.94,
        "createdAt": yesterday_iso
    }
    await set_doc("disease_scans", scan_doc["scan_id"], scan_doc)
    print("✓ Seeded diagnosed crop disease scan in Firestore")

    print("\n✅ ALL LIVE FIRESTORE DATA SUCCESSFULLY SEEDED FOR TUSHAR CHAUDHARI!")

if __name__ == "__main__":
    asyncio.run(seed())
