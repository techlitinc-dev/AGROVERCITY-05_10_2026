# Persona Activity

## ✅ bankManager — Branch Manager SBI Agri · `bank-loan-pipeline`  
**done** · 7 steps · satisfaction 2  
> "I can read the file, but where are the approve and disburse buttons? I cannot clear this loan from the queue with GET calls alone."  

1. GET /v1/loans/queue `review_queue_v1_loans_queue_get` → 200
2. GET /v1/loans/kcc_sbi_loan_312 `get_loan_v1_loans__applicationId__get` → 200
3. GET /v1/loans/kcc_sbi_loan_312/schedule `loan_schedule_v1_loans__applicationId__schedule_get` → 200
4. GET /v1/finance/loans `list_loans_v1_finance_loans_get` → 403

## ⚠️ customer — Priya Sharma · `customer-buy-basket`  
**step_cap** · 30 steps · satisfaction 1  
> "Bhai, itni der se product list aur prod-3 ghumake thak gayi, par mall wala weekly vegetable basket mila hi nahi — app ne dukaan ki jagah beej aur khad dikha di!"  

1. GET /v1/products `list_products_v1_products_get` → 200
2. GET /v1/products/prod-3 `get_product_v1_products__product_id__get` → 200
3. searched `Mujhe mall se weekly vegetable basket lena hai, pehle check karta hoon ki aisa koi product ya endpoint hai bhi ya nahi.` → found
4. searched `Pehli search se kuch clear nahi mila, ab specifically 'mall' aur 'vegetable basket' wale endpoints ya products dhoondta hoon.` → found
5. searched `Mall se weekly vegetable basket ka option dhoondhna hai, koi mall-specific product list endpoint ho sakta hai.` → found
6. searched `Ab 'mall', 'vegetable', 'basket', 'wallet' aur 'market' type endpoints dhoondhta hoon taaki sahi jagah weekly vegetable basket mil sake.` → found
7. GET /v1/market/lots/browse `browse_lots_v1_market_lots_browse_get` → 200
8. GET /v1/products `list_products_v1_products_get` → 200
9. GET /v1/products/prod-3 `get_product_v1_products__product_id__get` → 200
10. searched `Mujhe 'weekly vegetable basket' wala product chahiye mall se, isliye exact term search kar rahi hoon.` → found
11. searched `Lot ID yaad hai (lot_2ff7400d70d3), uska detail dekhna hai taaki confirm karoon ki yeh weekly vegetable basket hai mall se.` → found
12. searched `Lot ID lot_2ff7400d70d3 ka detail dekhna hai, 'get lot' ya 'market/lots/{lot_id}' endpoint dhoondh rahi hoon.` → found
13. GET /v1/market/lots/lot_2ff7400d70d3 `get_lot_v1_market_lots__lot_id__get` → 200
14. searched `List products endpoint ke query params jaanne hain, taaki 'weekly vegetable basket' mall se dhoondh sakoon.` → found
… (12 more steps in runs/smoke-20261021T17-57-07--customer-buy-basket.jsonl)

## ⚠️ farmer — Ramesh Patel · `farmer-sell-wheat`  
**step_cap** · 30 steps · satisfaction 1  
> "Bhai, baar baar tamatar ka daam dikhata raha, mujhe toh Anand ka gehu bechna tha, param samajh nahi aaya toh lot banane tak kabhi pahuncha hi nahi!"  

1. searched `Pahle Anand mandi me wheat ka aaj ka rate dekhna hai, kaunse params chahiye pata karun.` → found
2. GET /v1/mandi/prices `list_prices_v1_mandi_prices_get` → 200
3. GET /v1/mandi/prices `list_prices_v1_mandi_prices_get` → 200
4. GET /v1/mandi/prices `list_prices_v1_mandi_prices_get` → 200
5. GET /v1/mandi/prices `list_prices_v1_mandi_prices_get` → 200
6. searched `Baar baar tomato ka rate aa raha hai, mujhe Anand ka gehu ka rate chahiye. Endpoint ke query params dekhne hain.` → found
7. GET /v1/mandi/prices `list_prices_v1_mandi_prices_get` → 200
8. GET /v1/mandi/prices `list_prices_v1_mandi_prices_get` → 200
9. searched `Pahle sahi tareeke se Anand ka gehun ka bhav dekhna hai, parameters kya hain pata karo.` → no matches
10. GET /v1/mandi/prices `list_prices_v1_mandi_prices_get` → 200
11. searched `Bhai, baar baar tamatar ka rate aa raha hai, mujhe Anand mandi ka gehu ka rate chahiye. Endpoint mein kaunse filter lagte hain, ye dekhna hai.` → found
12. GET /v1/mandi/prices `list_prices_v1_mandi_prices_get` → 200
13. GET /v1/mandi/prices `list_prices_v1_mandi_prices_get` → 200
14. GET /v1/mandi/prices `list_prices_v1_mandi_prices_get` → 200
… (11 more steps in runs/smoke-20261021T17-57-07--farmer-sell-wheat.jsonl)

## ⚠️ seller — Mahesh Vyapari · `seller-procure-and-sell`  
**step_cap** · 30 steps · satisfaction 1  
> "Baar-baar same endpoint daba ke bhi pyaaj ka bhav nahi aaya, sirf tamatar dikha raha hai — time barbaad ho gaya aur kharidari bhi nahi ho paayi."  

1. searched `मुझे पहले onion के mandi rates देखने हैं — कौनसा lot खरीदना फायदेमंद है ये तय करने के लिए।` → found
2. GET /v1/mandi/vyapari-rates `vyapari_rates_v1_mandi_vyapari_rates_get` → 200
3. GET /v1/mandi/vyapari-rates `vyapari_rates_v1_mandi_vyapari_rates_get` → 200
4. GET /v1/mandi/vyapari-rates `vyapari_rates_v1_mandi_vyapari_rates_get` → 200
5. searched `Pyaaj ka bhav dekhna hai; tomato ka rate aa raha hai, onion ka nahi. Search karoon sahi endpoint ya filter.` → found
6. GET /v1/mandi/vyapari-rates `vyapari_rates_v1_mandi_vyapari_rates_get` → 200
7. GET /v1/market/lots/browse `browse_lots_v1_market_lots_browse_get` → 200
8. GET /v1/market/lots/lot_4066b5d46ebb `get_lot_v1_market_lots__lot_id__get` → 200
9. searched `Mujhe pehle onion ke mandi rates dekhne hain, koi direct endpoint nahi dikh raha, search karta hoon.` → found
10. GET /v1/mandi/vyapari-rates `vyapari_rates_v1_mandi_vyapari_rates_get` → 200
11. GET /v1/mandi/vyapari-rates `vyapari_rates_v1_mandi_vyapari_rates_get` → 200
12. searched `Onion ke liye mandi rates chahiye, endpoint mein query params kya hain dekhna hai.` → found
13. GET /v1/mandi/vyapari-rates `vyapari_rates_v1_mandi_vyapari_rates_get` → 200
14. searched `Onion ke mandi rates ke liye query params kya hain, is endpoint mein filter hai ya nahi — dekhna hai.` → found
… (6 more steps in runs/smoke-20261021T17-57-07--seller-procure-and-sell.jsonl)

## ⚠️ transporter — Suresh Vaghela · `transporter-run-trip`  
**step_cap** · 30 steps · satisfaction 1  
> "Bhai, itna ghumaya transporter banne ke liye, load list tak nahi khula, OTP toh door ki baat hai, ye app direct bata nahi sakta tha ke pehle profile activate karni hai?"  

1. GET /v1/transport/loads `list_open_loads_v1_transport_loads_get` → 403
2. GET /v1/transport/profile `get_transporter_profile_v1_transport_profile_get` → 403
3. searched `403 FORBIDDEN_ROLE aa raha hai transporter endpoint pe, Shayad mere role kuch aur hai ya sahi endpoint missing hai. Search kar leta hoon available transporter/load endpoints.` → found
4. GET /v1/transport/wallet `transport_wallet_v1_transport_wallet_get` → 403
5. searched `transporter endpoints 403 de rahe hain, shayad role galat hai. Pehle apna profile/role check karne wala endpoint dhoondta hoon.` → found
6. searched `Transporter endpoints 403 de rahe hain, role check karna hai. Profile ya user/role dikhane wala endpoint dhoond raha hoon.` → found
7. searched `Transporter sab endpoints 403 aa raha hai, toh pehle apna user role ya profile check karne ka endpoint dhoondna padega.` → found
8. GET /v1/transport/loads `list_open_loads_v1_transport_loads_get` → 403
9. GET /v1/transport/profile `get_transporter_profile_v1_transport_profile_get` → 403
10. searched `Transporter endpoints sab 403 bole role galat hai. Ab search karke dekhna padega ki role badalne ya transporter register karne ka koi endpoint hai ya nahi.` → found
11. searched `Transporter banna ya role update karne ka endpoint dhoondh raha hoon, bina role sahi kare trip nahi kar sakta.` → found
12. searched `Bhai transporter banna ka endpoint dhoondh raha hoon, profile/update ya onboarding wala.` → found
13. searched `Role 403 aa raha hai, register endpoint ka schema dekhna padega ki transporter role ka option hai ya nahi.` → found
14. searched `Role ka issue hai — register endpoint mein transporter role ka option check karta hoon.` → found
… (14 more steps in runs/smoke-20261021T17-57-07--transporter-run-trip.jsonl)
