# Review queue — human verdicts (specs §18a)

Verdicts go to config/known_gaps.yaml; not-real/duplicate-of suppress,
closed_by records the fix commit.

- [ ] #1 [bug-suspicion] Koi load select, quote, accept, OTP handover ya wallet check tak pahuncha nahi.  
      evidence: blocker @ oneshot-20261021T21-54-59--transporter-run-trip.meta.json · personas: transporter · score 3
- [ ] #2 [bug-suspicion] Bar bar tomato/dairy jaisi galat commodity ka rate aa raha tha, wheat ka nahi  
      evidence: blocker @ oneshot-20261021T21-52-56--farmer-sell-wheat.meta.json · personas: farmer · score 2
- [ ] #3 [feature-gap] Query params dhoondhne mein madad karne wala helper/search ya dropdown jisme mandi aur commodity select kar sa  
      evidence: debrief @ oneshot-20261021T21-52-56--farmer-sell-wheat.meta.json · personas: farmer · score 1
- [ ] #4 [feature-gap] Urea ka rate check karne ka alag saral option  
      evidence: debrief @ oneshot-20261021T21-52-56--farmer-sell-wheat.meta.json · personas: farmer · score 1
- [ ] #5 [bug-suspicion] Anand mandi ke ghehu ka sahi rate nahi mila kyunki /v1/mandi/prices endpoint ke query params pata nahi chale  
      evidence: blocker @ oneshot-20261021T21-52-56--farmer-sell-wheat.meta.json · personas: farmer · score 1
- [ ] #6 [bug-suspicion] Price check ke bina aage lot create nahi kar paya, offer bhi nahi dekh paya  
      evidence: blocker @ oneshot-20261021T21-52-56--farmer-sell-wheat.meta.json · personas: farmer · score 1
- [ ] #7 [feature-gap] Origin-destination city filter ya search option loads list mein  
      evidence: debrief @ oneshot-20261021T21-54-59--transporter-run-trip.meta.json · personas: transporter · score 1
- [ ] #8 [feature-gap] Endpoint query parameters ki clear documentation / schema  
      evidence: debrief @ oneshot-20261021T21-54-59--transporter-run-trip.meta.json · personas: transporter · score 1
- [ ] #9 [bug-suspicion] Rajkot se Ahmedabad ka load kabhi nahi mila, sirf Malegaon-Surat / Nasik-Surat wale loads aa rahe the.  
      evidence: blocker @ oneshot-20261021T21-54-59--transporter-run-trip.meta.json · personas: transporter · score 1
- [ ] #10 [bug-suspicion] list_open_loads endpoint ke query params / filter schema ka pata nahi chala.  
      evidence: blocker @ oneshot-20261021T21-54-59--transporter-run-trip.meta.json · personas: transporter · score 1
