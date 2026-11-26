// Authoritative NSE F&O Lot Sizes (Nov 2026 - Jan 2027)
const LOT_SIZES_MAP = {
  "BANKNIFTY": {
    "company": "Nifty Bank",
    "screener": "https://scanx.trade/stock-screener/index/nifty-bank",
    "symbol": "BANKNIFTY",
    "nov2026": 30,
    "dec2026": 30,
    "jan2027": 30,
    "currentLotSize": 30
  },
  "FINNIFTY": {
    "company": "Finnifty",
    "screener": "https://scanx.trade/stock-screener/index/nifty-financial-services",
    "symbol": "FINNIFTY",
    "nov2026": 60,
    "dec2026": 60,
    "jan2027": 60,
    "currentLotSize": 60
  },
  "MIDCPNIFTY": {
    "company": "Nifty Midcap Select",
    "screener": "https://scanx.trade/stock-screener/index/nifty-midcap-select",
    "symbol": "MIDCPNIFTY",
    "nov2026": 120,
    "dec2026": 120,
    "jan2027": 120,
    "currentLotSize": 120
  },
  "NIFTY": {
    "company": "Nifty 50",
    "screener": "https://scanx.trade/stock-screener/index/nifty-50",
    "symbol": "NIFTY",
    "nov2026": 65,
    "dec2026": 65,
    "jan2027": 65,
    "currentLotSize": 65
  },
  "NIFTYFPI": {
    "company": "Nifty FPI 150",
    "screener": "https://scanx.trade/stock-screener/index/nifty-fpi-150",
    "symbol": "NIFTYFPI",
    "nov2026": 1100,
    "dec2026": 1100,
    "jan2027": 1100,
    "currentLotSize": 1100
  },
  "NIFTYNXT50": {
    "company": "Nifty Next 50",
    "screener": "https://scanx.trade/stock-screener/index/nifty-next-50",
    "symbol": "NIFTYNXT50",
    "nov2026": 25,
    "dec2026": 25,
    "jan2027": 25,
    "currentLotSize": 25
  },
  "360ONE": {
    "company": "360 One WAM",
    "screener": "https://scanx.trade/company/360-one-wam-ltd",
    "symbol": "360ONE",
    "nov2026": 500,
    "dec2026": 500,
    "jan2027": 500,
    "currentLotSize": 500
  },
  "ABB": {
    "company": "ABB",
    "screener": "https://scanx.trade/company/abb-ltd",
    "symbol": "ABB",
    "nov2026": 125,
    "dec2026": 125,
    "jan2027": 125,
    "currentLotSize": 125
  },
  "ABCAPITAL": {
    "company": "Aditya Birla Capital",
    "screener": "https://scanx.trade/company/aditya-birla-capital-ltd",
    "symbol": "ABCAPITAL",
    "nov2026": 1550,
    "dec2026": 1550,
    "jan2027": 1550,
    "currentLotSize": 1550
  },
  "ADANIENSOL": {
    "company": "Adani Energy Solutions",
    "screener": "https://scanx.trade/company/adani-transmission-ltd",
    "symbol": "ADANIENSOL",
    "nov2026": 675,
    "dec2026": 675,
    "jan2027": 675,
    "currentLotSize": 675
  },
  "ADANIENT": {
    "company": "Adani Enterprises",
    "screener": "https://scanx.trade/company/adani-enterprises-ltd",
    "symbol": "ADANIENT",
    "nov2026": 309,
    "dec2026": 309,
    "jan2027": 309,
    "currentLotSize": 309
  },
  "ADANIGREEN": {
    "company": "Adani Green Energy",
    "screener": "https://scanx.trade/company/adani-green-energy-ltd",
    "symbol": "ADANIGREEN",
    "nov2026": 600,
    "dec2026": 600,
    "jan2027": 600,
    "currentLotSize": 600
  },
  "ADANIPORTS": {
    "company": "Adani Ports & SEZ",
    "screener": "https://scanx.trade/company/adani-ports-sez-ltd",
    "symbol": "ADANIPORTS",
    "nov2026": 475,
    "dec2026": 475,
    "jan2027": 475,
    "currentLotSize": 475
  },
  "ADANIPOWER": {
    "company": "Adani Power",
    "screener": "https://scanx.trade/company/adani-power-ltd",
    "symbol": "ADANIPOWER",
    "nov2026": 3550,
    "dec2026": 3550,
    "jan2027": 3550,
    "currentLotSize": 3550
  },
  "ALKEM": {
    "company": "Alkem Laboratories",
    "screener": "https://scanx.trade/company/alkem-laboratories-ltd",
    "symbol": "ALKEM",
    "nov2026": 125,
    "dec2026": 125,
    "jan2027": 125,
    "currentLotSize": 125
  },
  "AMBER": {
    "company": "Amber Enterprises",
    "screener": "https://scanx.trade/company/amber-enterprises-india-ltd",
    "symbol": "AMBER",
    "nov2026": 100,
    "dec2026": 100,
    "jan2027": 100,
    "currentLotSize": 100
  },
  "AMBUJACEM": {
    "company": "Ambuja Cements",
    "screener": "https://scanx.trade/company/ambuja-cements-ltd",
    "symbol": "AMBUJACEM",
    "nov2026": 1200,
    "dec2026": 1200,
    "jan2027": 1350,
    "currentLotSize": 1200
  },
  "ANANDRATHI": {
    "company": "Anand Rathi Wealth",
    "screener": "https://scanx.trade/company/anand-rathi-wealth-ltd",
    "symbol": "ANANDRATHI",
    "nov2026": 250,
    "dec2026": 250,
    "jan2027": 250,
    "currentLotSize": 250
  },
  "ANGELONE": {
    "company": "Angel One",
    "screener": "https://scanx.trade/company/angel-broking-ltd",
    "symbol": "ANGELONE",
    "nov2026": 2500,
    "dec2026": 2500,
    "jan2027": 2500,
    "currentLotSize": 2500
  },
  "APLAPOLLO": {
    "company": "APL Apollo Tubes",
    "screener": "https://scanx.trade/company/apl-apollo-tubes-ltd",
    "symbol": "APLAPOLLO",
    "nov2026": 350,
    "dec2026": 350,
    "jan2027": 350,
    "currentLotSize": 350
  },
  "APOLLOHOSP": {
    "company": "Apollo Hospitals",
    "screener": "https://scanx.trade/company/apollo-hospitals-ltd",
    "symbol": "APOLLOHOSP",
    "nov2026": 125,
    "dec2026": 125,
    "jan2027": 75,
    "currentLotSize": 125
  },
  "ASHOKLEY": {
    "company": "Ashok Leyland",
    "screener": "https://scanx.trade/company/ashok-leyland-ltd",
    "symbol": "ASHOKLEY",
    "nov2026": 5000,
    "dec2026": 5000,
    "jan2027": 5000,
    "currentLotSize": 5000
  },
  "ASIANPAINT": {
    "company": "Asian Paints",
    "screener": "https://scanx.trade/company/asian-paints-ltd",
    "symbol": "ASIANPAINT",
    "nov2026": 250,
    "dec2026": 250,
    "jan2027": 250,
    "currentLotSize": 250
  },
  "ASTRAL": {
    "company": "Astral",
    "screener": "https://scanx.trade/company/astral-poly-technik-ltd",
    "symbol": "ASTRAL",
    "nov2026": 425,
    "dec2026": 425,
    "jan2027": 425,
    "currentLotSize": 425
  },
  "ATHERENERG": {
    "company": "Ather Energy",
    "screener": "https://scanx.trade/company/ather-energy-ltd",
    "symbol": "ATHERENERG",
    "nov2026": 375,
    "dec2026": 375,
    "jan2027": 375,
    "currentLotSize": 375
  },
  "AUBANK": {
    "company": "AU Small Finance Bank",
    "screener": "https://scanx.trade/company/au-small-finance-bank-ltd",
    "symbol": "AUBANK",
    "nov2026": 500,
    "dec2026": 500,
    "jan2027": 500,
    "currentLotSize": 500
  },
  "AUROPHARMA": {
    "company": "Aurobindo Pharma",
    "screener": "https://scanx.trade/company/aurobindo-pharma-ltd",
    "symbol": "AUROPHARMA",
    "nov2026": 550,
    "dec2026": 550,
    "jan2027": 550,
    "currentLotSize": 550
  },
  "AXISBANK": {
    "company": "Axis Bank",
    "screener": "https://scanx.trade/company/axis-bank-ltd",
    "symbol": "AXISBANK",
    "nov2026": 625,
    "dec2026": 625,
    "jan2027": 625,
    "currentLotSize": 625
  },
  "BAJAJ-AUTO": {
    "company": "Bajaj Auto",
    "screener": "https://scanx.trade/company/bajaj-auto-ltd",
    "symbol": "BAJAJ-AUTO",
    "nov2026": 75,
    "dec2026": 75,
    "jan2027": 75,
    "currentLotSize": 75
  },
  "BAJAJFINSV": {
    "company": "Bajaj Finserv",
    "screener": "https://scanx.trade/company/bajaj-finserv-ltd",
    "symbol": "BAJAJFINSV",
    "nov2026": 300,
    "dec2026": 300,
    "jan2027": 300,
    "currentLotSize": 300
  },
  "BAJFINANCE": {
    "company": "Bajaj Finance",
    "screener": "https://scanx.trade/company/bajaj-finance-ltd",
    "symbol": "BAJFINANCE",
    "nov2026": 750,
    "dec2026": 750,
    "jan2027": 750,
    "currentLotSize": 750
  },
  "BANDHANBNK": {
    "company": "Bandhan Bank",
    "screener": "https://scanx.trade/company/bandhan-bank-ltd",
    "symbol": "BANDHANBNK",
    "nov2026": 3600,
    "dec2026": 3600,
    "jan2027": 3600,
    "currentLotSize": 3600
  },
  "BANKBARODA": {
    "company": "Bank of Baroda",
    "screener": "https://scanx.trade/company/bank-of-baroda-ltd",
    "symbol": "BANKBARODA",
    "nov2026": 2925,
    "dec2026": 2925,
    "jan2027": 2925,
    "currentLotSize": 2925
  },
  "BANKINDIA": {
    "company": "Bank of India",
    "screener": "https://scanx.trade/company/bank-of-india-ltd",
    "symbol": "BANKINDIA",
    "nov2026": 5200,
    "dec2026": 5200,
    "jan2027": 5200,
    "currentLotSize": 5200
  },
  "BDL": {
    "company": "Bharat Dynamics",
    "screener": "https://scanx.trade/company/bharat-dynamics-ltd",
    "symbol": "BDL",
    "nov2026": 425,
    "dec2026": 425,
    "jan2027": 425,
    "currentLotSize": 425
  },
  "BEL": {
    "company": "Bharat Electronics",
    "screener": "https://scanx.trade/company/bharat-electronics-ltd",
    "symbol": "BEL",
    "nov2026": 1425,
    "dec2026": 1425,
    "jan2027": 1425,
    "currentLotSize": 1425
  },
  "BHARATFORG": {
    "company": "Bharat Forge",
    "screener": "https://scanx.trade/company/bharat-forge-ltd",
    "symbol": "BHARATFORG",
    "nov2026": 500,
    "dec2026": 500,
    "jan2027": 500,
    "currentLotSize": 500
  },
  "BHARTIARTL": {
    "company": "Bharti Airtel",
    "screener": "https://scanx.trade/company/bharti-airtel-ltd",
    "symbol": "BHARTIARTL",
    "nov2026": 475,
    "dec2026": 475,
    "jan2027": 475,
    "currentLotSize": 475
  },
  "BHEL": {
    "company": "Bharat Heavy Electricals",
    "screener": "https://scanx.trade/company/bhel-bharat-heavy-electricals-ltd",
    "symbol": "BHEL",
    "nov2026": 2625,
    "dec2026": 2625,
    "jan2027": 1250,
    "currentLotSize": 2625
  },
  "BIOCON": {
    "company": "Biocon",
    "screener": "https://scanx.trade/company/biocon-ltd",
    "symbol": "BIOCON",
    "nov2026": 2500,
    "dec2026": 2500,
    "jan2027": 2500,
    "currentLotSize": 2500
  },
  "BLUESTARCO": {
    "company": "Blue Star",
    "screener": "https://scanx.trade/company/blue-star-ltd",
    "symbol": "BLUESTARCO",
    "nov2026": 325,
    "dec2026": 325,
    "jan2027": 350,
    "currentLotSize": 325
  },
  "BOSCHLTD": {
    "company": "Bosch",
    "screener": "https://scanx.trade/company/bosch-ltd",
    "symbol": "BOSCHLTD",
    "nov2026": 25,
    "dec2026": 25,
    "jan2027": 15,
    "currentLotSize": 25
  },
  "BPCL": {
    "company": "Bharat Petroleum",
    "screener": "https://scanx.trade/company/bharat-petroleum-ltd",
    "symbol": "BPCL",
    "nov2026": 1975,
    "dec2026": 1975,
    "jan2027": 1975,
    "currentLotSize": 1975
  },
  "BRITANNIA": {
    "company": "Britannia Industries",
    "screener": "https://scanx.trade/company/britannia-industries-ltd",
    "symbol": "BRITANNIA",
    "nov2026": 125,
    "dec2026": 125,
    "jan2027": 125,
    "currentLotSize": 125
  },
  "BSE": {
    "company": "BSE",
    "screener": "https://scanx.trade/company/bse-ltd",
    "symbol": "BSE",
    "nov2026": 200,
    "dec2026": 200,
    "jan2027": 200,
    "currentLotSize": 200
  },
  "CAMS": {
    "company": "CAMS",
    "screener": "https://scanx.trade/company/cams-ltd",
    "symbol": "CAMS",
    "nov2026": 825,
    "dec2026": 825,
    "jan2027": 825,
    "currentLotSize": 825
  },
  "CANBK": {
    "company": "Canara Bank",
    "screener": "https://scanx.trade/company/canara-bank-ltd",
    "symbol": "CANBK",
    "nov2026": 6750,
    "dec2026": 6750,
    "jan2027": 6750,
    "currentLotSize": 6750
  },
  "CDSL": {
    "company": "CDSL",
    "screener": "https://scanx.trade/company/central-depository-services-ltd",
    "symbol": "CDSL",
    "nov2026": 475,
    "dec2026": 475,
    "jan2027": 475,
    "currentLotSize": 475
  },
  "CGPOWER": {
    "company": "CG Power & Industrial Solutions",
    "screener": "https://scanx.trade/company/cg-power-and-industrial-solutions-ltd",
    "symbol": "CGPOWER",
    "nov2026": 850,
    "dec2026": 850,
    "jan2027": 850,
    "currentLotSize": 850
  },
  "CHOLAFIN": {
    "company": "Cholamandalam Investment",
    "screener": "https://scanx.trade/company/cholamandalam-investment-ltd",
    "symbol": "CHOLAFIN",
    "nov2026": 625,
    "dec2026": 625,
    "jan2027": 300,
    "currentLotSize": 625
  },
  "CIPLA": {
    "company": "Cipla",
    "screener": "https://scanx.trade/company/cipla-ltd",
    "symbol": "CIPLA",
    "nov2026": 425,
    "dec2026": 425,
    "jan2027": 425,
    "currentLotSize": 425
  },
  "COALINDIA": {
    "company": "Coal India",
    "screener": "https://scanx.trade/company/coal-india-ltd",
    "symbol": "COALINDIA",
    "nov2026": 1350,
    "dec2026": 1350,
    "jan2027": 1350,
    "currentLotSize": 1350
  },
  "COCHINSHIP": {
    "company": "Cochin Shipyard",
    "screener": "https://scanx.trade/company/cochin-shipyard-ltd",
    "symbol": "COCHINSHIP",
    "nov2026": 400,
    "dec2026": 400,
    "jan2027": 400,
    "currentLotSize": 400
  },
  "COFORGE": {
    "company": "Coforge",
    "screener": "https://scanx.trade/company/coforge-ltd",
    "symbol": "COFORGE",
    "nov2026": 475,
    "dec2026": 475,
    "jan2027": 475,
    "currentLotSize": 475
  },
  "COLPAL": {
    "company": "Colgate Palmolive",
    "screener": "https://scanx.trade/company/colgate-palmolive-ltd",
    "symbol": "COLPAL",
    "nov2026": 275,
    "dec2026": 275,
    "jan2027": 275,
    "currentLotSize": 275
  },
  "CONCOR": {
    "company": "Container Corporation of India",
    "screener": "https://scanx.trade/company/container-corporation-of-india-ltd",
    "symbol": "CONCOR",
    "nov2026": 1250,
    "dec2026": 1250,
    "jan2027": 1250,
    "currentLotSize": 1250
  },
  "COROMANDEL": {
    "company": "Coromandel International",
    "screener": "https://scanx.trade/company/coromandel-international-ltd",
    "symbol": "COROMANDEL",
    "nov2026": 300,
    "dec2026": 300,
    "jan2027": 300,
    "currentLotSize": 300
  },
  "CROMPTON": {
    "company": "Crompton Greaves",
    "screener": "https://scanx.trade/company/crompton-greaves-consumer-electricals-ltd",
    "symbol": "CROMPTON",
    "nov2026": 2150,
    "dec2026": 2150,
    "jan2027": 2325,
    "currentLotSize": 2150
  },
  "CUB": {
    "company": "City Union Bank",
    "screener": "https://scanx.trade/company/city-union-bank-ltd",
    "symbol": "CUB",
    "nov2026": 2325,
    "dec2026": 2325,
    "jan2027": 2325,
    "currentLotSize": 2325
  },
  "CUMMINSIND": {
    "company": "Cummins",
    "screener": "https://scanx.trade/company/cummins-india-ltd",
    "symbol": "CUMMINSIND",
    "nov2026": 100,
    "dec2026": 100,
    "jan2027": 100,
    "currentLotSize": 100
  },
  "DABUR": {
    "company": "Dabur India",
    "screener": "https://scanx.trade/company/dabur-india-ltd",
    "symbol": "DABUR",
    "nov2026": 1250,
    "dec2026": 1250,
    "jan2027": 1375,
    "currentLotSize": 1250
  },
  "DATAPATTNS": {
    "company": "Data Patterns",
    "screener": "https://scanx.trade/company/data-patterns-india-ltd",
    "symbol": "DATAPATTNS",
    "nov2026": 125,
    "dec2026": 125,
    "jan2027": 125,
    "currentLotSize": 125
  },
  "DELHIVERY": {
    "company": "Delhivery",
    "screener": "https://scanx.trade/company/delhivery-ltd",
    "symbol": "DELHIVERY",
    "nov2026": 2075,
    "dec2026": 2075,
    "jan2027": 2075,
    "currentLotSize": 2075
  },
  "DIVISLAB": {
    "company": "Divis Laboratories",
    "screener": "https://scanx.trade/company/divis-laboratories-ltd",
    "symbol": "DIVISLAB",
    "nov2026": 100,
    "dec2026": 100,
    "jan2027": 100,
    "currentLotSize": 100
  },
  "DIXON": {
    "company": "Dixon Technologies",
    "screener": "https://scanx.trade/company/dixon-technologies-ltd",
    "symbol": "DIXON",
    "nov2026": 50,
    "dec2026": 50,
    "jan2027": 50,
    "currentLotSize": 50
  },
  "DLF": {
    "company": "DLF",
    "screener": "https://scanx.trade/company/dlf-ltd",
    "symbol": "DLF",
    "nov2026": 950,
    "dec2026": 950,
    "jan2027": 950,
    "currentLotSize": 950
  },
  "DMART": {
    "company": "Avenue Supermarts DMart",
    "screener": "https://scanx.trade/company/dmart-avenue-supermarts-ltd",
    "symbol": "DMART",
    "nov2026": 150,
    "dec2026": 150,
    "jan2027": 150,
    "currentLotSize": 150
  },
  "DRREDDY": {
    "company": "Dr Reddys Laboratories",
    "screener": "https://scanx.trade/company/dr-reddys-laboratories-ltd",
    "symbol": "DRREDDY",
    "nov2026": 625,
    "dec2026": 625,
    "jan2027": 625,
    "currentLotSize": 625
  },
  "EICHERMOT": {
    "company": "Eicher Motors",
    "screener": "https://scanx.trade/company/eicher-motors-ltd",
    "symbol": "EICHERMOT",
    "nov2026": 100,
    "dec2026": 100,
    "jan2027": 100,
    "currentLotSize": 100
  },
  "ENRIN": {
    "company": "Siemens Energy",
    "screener": "https://scanx.trade/company/siemens-energy-ltd",
    "symbol": "ENRIN",
    "nov2026": 175,
    "dec2026": 175,
    "jan2027": 175,
    "currentLotSize": 175
  },
  "ETERNAL": {
    "company": "Eternal",
    "screener": "https://scanx.trade/company/zomato-ltd",
    "symbol": "ETERNAL",
    "nov2026": 2425,
    "dec2026": 2425,
    "jan2027": 2425,
    "currentLotSize": 2425
  },
  "FEDERALBNK": {
    "company": "Federal Bank",
    "screener": "https://scanx.trade/company/federal-bank-ltd",
    "symbol": "FEDERALBNK",
    "nov2026": 2500,
    "dec2026": 2500,
    "jan2027": 2500,
    "currentLotSize": 2500
  },
  "FORCEMOT": {
    "company": "Force Motors",
    "screener": "https://scanx.trade/company/force-motors-ltd",
    "symbol": "FORCEMOT",
    "nov2026": 25,
    "dec2026": 25,
    "jan2027": 30,
    "currentLotSize": 25
  },
  "FORTIS": {
    "company": "Fortis Healthcare",
    "screener": "https://scanx.trade/company/fortis-healthcare-ltd",
    "symbol": "FORTIS",
    "nov2026": 775,
    "dec2026": 775,
    "jan2027": 775,
    "currentLotSize": 775
  },
  "GAIL": {
    "company": "GAIL",
    "screener": "https://scanx.trade/company/gail-ltd",
    "symbol": "GAIL",
    "nov2026": 3550,
    "dec2026": 3550,
    "jan2027": 3550,
    "currentLotSize": 3550
  },
  "GLENMARK": {
    "company": "Glenmark Pharmaceuticals",
    "screener": "https://scanx.trade/company/glenmark-pharmaceuticals-ltd",
    "symbol": "GLENMARK",
    "nov2026": 375,
    "dec2026": 375,
    "jan2027": 375,
    "currentLotSize": 375
  },
  "GMRAIRPORT": {
    "company": "GMR Airports",
    "screener": "https://scanx.trade/company/gmr-infrastructure-ltd",
    "symbol": "GMRAIRPORT",
    "nov2026": 6975,
    "dec2026": 6975,
    "jan2027": 6975,
    "currentLotSize": 6975
  },
  "GODFRYPHLP": {
    "company": "Godfrey Phillips",
    "screener": "https://scanx.trade/company/godfrey-phillips-india-ltd",
    "symbol": "GODFRYPHLP",
    "nov2026": 275,
    "dec2026": 275,
    "jan2027": 275,
    "currentLotSize": 275
  },
  "GODREJCP": {
    "company": "Godrej Consumer Products",
    "screener": "https://scanx.trade/company/godrej-consumer-products-ltd",
    "symbol": "GODREJCP",
    "nov2026": 500,
    "dec2026": 500,
    "jan2027": 600,
    "currentLotSize": 500
  },
  "GODREJPROP": {
    "company": "Godrej Properties",
    "screener": "https://scanx.trade/company/godrej-properties-ltd",
    "symbol": "GODREJPROP",
    "nov2026": 325,
    "dec2026": 325,
    "jan2027": 325,
    "currentLotSize": 325
  },
  "GRASIM": {
    "company": "Grasim Industries",
    "screener": "https://scanx.trade/company/grasim-industries-ltd",
    "symbol": "GRASIM",
    "nov2026": 250,
    "dec2026": 250,
    "jan2027": 250,
    "currentLotSize": 250
  },
  "GVT&D": {
    "company": "GE Vernova T&D",
    "screener": "https://scanx.trade/company/ge-td-india-ltd",
    "symbol": "GVT&D",
    "nov2026": 125,
    "dec2026": 125,
    "jan2027": 125,
    "currentLotSize": 125
  },
  "HAL": {
    "company": "Hindustan Aeronautics",
    "screener": "https://scanx.trade/company/hal-hindustan-aeronautics-ltd",
    "symbol": "HAL",
    "nov2026": 150,
    "dec2026": 150,
    "jan2027": 150,
    "currentLotSize": 150
  },
  "HAVELLS": {
    "company": "Havells",
    "screener": "https://scanx.trade/company/havells-india-ltd",
    "symbol": "HAVELLS",
    "nov2026": 500,
    "dec2026": 500,
    "jan2027": 500,
    "currentLotSize": 500
  },
  "HCLTECH": {
    "company": "HCL Technologies",
    "screener": "https://scanx.trade/company/hcl-technologies-ltd",
    "symbol": "HCLTECH",
    "nov2026": 400,
    "dec2026": 400,
    "jan2027": 400,
    "currentLotSize": 400
  },
  "HDFCAMC": {
    "company": "HDFC AMC",
    "screener": "https://scanx.trade/company/hdfc-asset-management-company-ltd",
    "symbol": "HDFCAMC",
    "nov2026": 300,
    "dec2026": 300,
    "jan2027": 300,
    "currentLotSize": 300
  },
  "HDFCBANK": {
    "company": "HDFC Bank",
    "screener": "https://scanx.trade/company/hdfc-bank-ltd",
    "symbol": "HDFCBANK",
    "nov2026": 650,
    "dec2026": 650,
    "jan2027": 750,
    "currentLotSize": 650
  },
  "HDFCLIFE": {
    "company": "HDFC Life Insurance",
    "screener": "https://scanx.trade/company/hdfc-life-insurance-ltd",
    "symbol": "HDFCLIFE",
    "nov2026": 1100,
    "dec2026": 1100,
    "jan2027": 1100,
    "currentLotSize": 1100
  },
  "HEROMOTOCO": {
    "company": "Hero Motocorp",
    "screener": "https://scanx.trade/company/hero-motocorp-ltd",
    "symbol": "HEROMOTOCO",
    "nov2026": 150,
    "dec2026": 150,
    "jan2027": 150,
    "currentLotSize": 150
  },
  "HINDALCO": {
    "company": "Hindalco Industries",
    "screener": "https://scanx.trade/company/hindalco-industries-ltd",
    "symbol": "HINDALCO",
    "nov2026": 700,
    "dec2026": 700,
    "jan2027": 700,
    "currentLotSize": 700
  },
  "HINDPETRO": {
    "company": "Hindustan Petroleum",
    "screener": "https://scanx.trade/company/hindustan-petroleum-ltd",
    "symbol": "HINDPETRO",
    "nov2026": 2025,
    "dec2026": 2025,
    "jan2027": 2025,
    "currentLotSize": 2025
  },
  "HINDUNILVR": {
    "company": "Hindustan Unilever",
    "screener": "https://scanx.trade/company/hindustan-unilever-ltd",
    "symbol": "HINDUNILVR",
    "nov2026": 300,
    "dec2026": 300,
    "jan2027": 300,
    "currentLotSize": 300
  },
  "HINDZINC": {
    "company": "Hindustan Zinc",
    "screener": "https://scanx.trade/company/hindustan-zinc-ltd",
    "symbol": "HINDZINC",
    "nov2026": 1225,
    "dec2026": 1225,
    "jan2027": 1225,
    "currentLotSize": 1225
  },
  "HYUNDAI": {
    "company": "Hyundai Motor India",
    "screener": "https://scanx.trade/company/hyundai-motor-india-ltd",
    "symbol": "HYUNDAI",
    "nov2026": 275,
    "dec2026": 275,
    "jan2027": 275,
    "currentLotSize": 275
  },
  "ICICIBANK": {
    "company": "ICICI Bank",
    "screener": "https://scanx.trade/company/icici-bank-ltd",
    "symbol": "ICICIBANK",
    "nov2026": 700,
    "dec2026": 700,
    "jan2027": 700,
    "currentLotSize": 700
  },
  "ICICIGI": {
    "company": "ICICI Lombard General Insurance",
    "screener": "https://scanx.trade/company/icici-lombard-general-insurance-ltd",
    "symbol": "ICICIGI",
    "nov2026": 325,
    "dec2026": 325,
    "jan2027": 350,
    "currentLotSize": 325
  },
  "ICICILIFE": {
    "company": "ICICI Life Insurance",
    "screener": "https://scanx.trade/company/icici-life-insurance-ltd",
    "symbol": "ICICILIFE",
    "nov2026": 925,
    "dec2026": 925,
    "jan2027": 1100,
    "currentLotSize": 925
  },
  "IDEA": {
    "company": "Vodafone Idea",
    "screener": "https://scanx.trade/company/vodafone-idea-ltd",
    "symbol": "IDEA",
    "nov2026": 71475,
    "dec2026": 71475,
    "jan2027": 36125,
    "currentLotSize": 71475
  },
  "IDFCFIRSTB": {
    "company": "IDFC First Bank",
    "screener": "https://scanx.trade/company/idfc-first-bank-ltd",
    "symbol": "IDFCFIRSTB",
    "nov2026": 9275,
    "dec2026": 9275,
    "jan2027": 9275,
    "currentLotSize": 9275
  },
  "IEX": {
    "company": "Indian Energy Exchange",
    "screener": "https://scanx.trade/company/indian-energy-exchange-ltd",
    "symbol": "IEX",
    "nov2026": 4350,
    "dec2026": 4350,
    "jan2027": 4350,
    "currentLotSize": 4350
  },
  "INDHOTEL": {
    "company": "Indian Hotels Company",
    "screener": "https://scanx.trade/company/indian-hotels-company-ltd",
    "symbol": "INDHOTEL",
    "nov2026": 1000,
    "dec2026": 1000,
    "jan2027": 1000,
    "currentLotSize": 1000
  },
  "INDIANB": {
    "company": "Indian Bank",
    "screener": "https://scanx.trade/company/indian-bank-ltd",
    "symbol": "INDIANB",
    "nov2026": 1000,
    "dec2026": 1000,
    "jan2027": 1000,
    "currentLotSize": 1000
  },
  "INDIGO": {
    "company": "Interglobe Aviation",
    "screener": "https://scanx.trade/company/indigo-interglobe-aviation-ltd",
    "symbol": "INDIGO",
    "nov2026": 150,
    "dec2026": 150,
    "jan2027": 150,
    "currentLotSize": 150
  },
  "INDUSINDBK": {
    "company": "Indusind Bank",
    "screener": "https://scanx.trade/company/indusind-bank-ltd",
    "symbol": "INDUSINDBK",
    "nov2026": 700,
    "dec2026": 700,
    "jan2027": 700,
    "currentLotSize": 700
  },
  "INDUSTOWER": {
    "company": "Indus Towers",
    "screener": "https://scanx.trade/company/bharti-infratel-ltd",
    "symbol": "INDUSTOWER",
    "nov2026": 1700,
    "dec2026": 1700,
    "jan2027": 1700,
    "currentLotSize": 1700
  },
  "INFY": {
    "company": "Infosys",
    "screener": "https://scanx.trade/company/infosys-ltd",
    "symbol": "INFY",
    "nov2026": 400,
    "dec2026": 400,
    "jan2027": 500,
    "currentLotSize": 400
  },
  "INOXWIND": {
    "company": "Inox Wind",
    "screener": "https://scanx.trade/company/inox-wind-ltd",
    "symbol": "INOXWIND",
    "nov2026": 6400,
    "dec2026": 6400,
    "jan2027": 6400,
    "currentLotSize": 6400
  },
  "IOC": {
    "company": "Indian Oil Corporation",
    "screener": "https://scanx.trade/company/indian-oil-corporation-ltd",
    "symbol": "IOC",
    "nov2026": 4875,
    "dec2026": 4875,
    "jan2027": 4875,
    "currentLotSize": 4875
  },
  "IREDA": {
    "company": "IREDA",
    "screener": "https://scanx.trade/company/ireda-ltd",
    "symbol": "IREDA",
    "nov2026": 4525,
    "dec2026": 4525,
    "jan2027": 4525,
    "currentLotSize": 4525
  },
  "IRFC": {
    "company": "IRFC",
    "screener": "https://scanx.trade/company/indian-railway-finance-corp-ltd",
    "symbol": "IRFC",
    "nov2026": 5425,
    "dec2026": 5425,
    "jan2027": 6450,
    "currentLotSize": 5425
  },
  "ITC": {
    "company": "ITC",
    "screener": "https://scanx.trade/company/itc-ltd",
    "symbol": "ITC",
    "nov2026": 1725,
    "dec2026": 1725,
    "jan2027": 1975,
    "currentLotSize": 1725
  },
  "JINDALSTEL": {
    "company": "Jindal Steel",
    "screener": "https://scanx.trade/company/jindal-steel-ltd",
    "symbol": "JINDALSTEL",
    "nov2026": 625,
    "dec2026": 625,
    "jan2027": 625,
    "currentLotSize": 625
  },
  "JIOFIN": {
    "company": "Jio Financial Services",
    "screener": "https://scanx.trade/company/jio-financial-services-ltd",
    "symbol": "JIOFIN",
    "nov2026": 2350,
    "dec2026": 2350,
    "jan2027": 2350,
    "currentLotSize": 2350
  },
  "JSWENERGY": {
    "company": "JSW Energy",
    "screener": "https://scanx.trade/company/jsw-energy-ltd",
    "symbol": "JSWENERGY",
    "nov2026": 1075,
    "dec2026": 1075,
    "jan2027": 1075,
    "currentLotSize": 1075
  },
  "JSWSTEEL": {
    "company": "JSW Steel",
    "screener": "https://scanx.trade/company/jsw-steel-ltd",
    "symbol": "JSWSTEEL",
    "nov2026": 675,
    "dec2026": 675,
    "jan2027": 675,
    "currentLotSize": 675
  },
  "JUBLFOOD": {
    "company": "Jubilant FoodWorks",
    "screener": "https://scanx.trade/company/jubilant-foodworks-ltd",
    "symbol": "JUBLFOOD",
    "nov2026": 1250,
    "dec2026": 1250,
    "jan2027": 1250,
    "currentLotSize": 1250
  },
  "KALYANKJIL": {
    "company": "Kalyan Jewellers",
    "screener": "https://scanx.trade/company/kalyan-jewellers-ltd",
    "symbol": "KALYANKJIL",
    "nov2026": 1350,
    "dec2026": 1350,
    "jan2027": 1350,
    "currentLotSize": 1350
  },
  "KARURVYSYA": {
    "company": "Karur Vysya Bank",
    "screener": "https://scanx.trade/company/karur-vysya-bank-ltd",
    "symbol": "KARURVYSYA",
    "nov2026": 1550,
    "dec2026": 1550,
    "jan2027": 1550,
    "currentLotSize": 1550
  },
  "KAYNES": {
    "company": "Kaynes Technology India",
    "screener": "https://scanx.trade/company/kaynes-technology-ltd",
    "symbol": "KAYNES",
    "nov2026": 150,
    "dec2026": 150,
    "jan2027": 150,
    "currentLotSize": 150
  },
  "KEI": {
    "company": "KEI Industries",
    "screener": "https://scanx.trade/company/kei-industries-ltd",
    "symbol": "KEI",
    "nov2026": 175,
    "dec2026": 175,
    "jan2027": 175,
    "currentLotSize": 175
  },
  "KFINTECH": {
    "company": "KFin Technologies",
    "screener": "https://scanx.trade/company/kfin-technologies-ltd",
    "symbol": "KFINTECH",
    "nov2026": 575,
    "dec2026": 575,
    "jan2027": 575,
    "currentLotSize": 575
  },
  "KOTAKBANK": {
    "company": "Kotak Bank",
    "screener": "https://scanx.trade/company/kotak-mahindra-bank-ltd",
    "symbol": "KOTAKBANK",
    "nov2026": 2000,
    "dec2026": 2000,
    "jan2027": 2000,
    "currentLotSize": 2000
  },
  "KPITTECH": {
    "company": "KPIT Technologies",
    "screener": "https://scanx.trade/company/kpit-technologies-ltd",
    "symbol": "KPITTECH",
    "nov2026": 775,
    "dec2026": 775,
    "jan2027": 975,
    "currentLotSize": 775
  },
  "LAURUSLABS": {
    "company": "Laurus Labs",
    "screener": "https://scanx.trade/company/laurus-labs-ltd",
    "symbol": "LAURUSLABS",
    "nov2026": 425,
    "dec2026": 425,
    "jan2027": 425,
    "currentLotSize": 425
  },
  "LICHSGFIN": {
    "company": "LIC Housing Finance",
    "screener": "https://scanx.trade/company/lic-housing-finance-ltd",
    "symbol": "LICHSGFIN",
    "nov2026": 1000,
    "dec2026": 1000,
    "jan2027": 1000,
    "currentLotSize": 1000
  },
  "LICI": {
    "company": "LIC of India",
    "screener": "https://scanx.trade/company/lic-of-india-ltd",
    "symbol": "LICI",
    "nov2026": 1400,
    "dec2026": 1400,
    "jan2027": 1400,
    "currentLotSize": 1400
  },
  "LODHA": {
    "company": "Lodha Developers",
    "screener": "https://scanx.trade/company/macrotech-developers-ltd",
    "symbol": "LODHA",
    "nov2026": 625,
    "dec2026": 625,
    "jan2027": 625,
    "currentLotSize": 625
  },
  "LT": {
    "company": "Larsen & Toubro",
    "screener": "https://scanx.trade/company/lt-larsen-toubro-ltd",
    "symbol": "LT",
    "nov2026": 175,
    "dec2026": 175,
    "jan2027": 175,
    "currentLotSize": 175
  },
  "LTF": {
    "company": "L&T Finance",
    "screener": "https://scanx.trade/company/lt-finance-holdings-ltd",
    "symbol": "LTF",
    "nov2026": 2250,
    "dec2026": 2250,
    "jan2027": 2250,
    "currentLotSize": 2250
  },
  "LTM": {
    "company": "LTM",
    "screener": "https://scanx.trade/company/lti-larsen-toubro-infotech-ltd",
    "symbol": "LTM",
    "nov2026": 150,
    "dec2026": 150,
    "jan2027": 150,
    "currentLotSize": 150
  },
  "LUPIN": {
    "company": "Lupin",
    "screener": "https://scanx.trade/company/lupin-ltd",
    "symbol": "LUPIN",
    "nov2026": 425,
    "dec2026": 425,
    "jan2027": 425,
    "currentLotSize": 425
  },
  "M&M": {
    "company": "Mahindra & Mahindra",
    "screener": "https://scanx.trade/company/mahindra-mahindra-ltd",
    "symbol": "M&M",
    "nov2026": 200,
    "dec2026": 200,
    "jan2027": 200,
    "currentLotSize": 200
  },
  "MAHABANK": {
    "company": "Bank of Maharashtra",
    "screener": "https://scanx.trade/company/bank-of-maharashtra-ltd",
    "symbol": "MAHABANK",
    "nov2026": 6500,
    "dec2026": 6500,
    "jan2027": 6500,
    "currentLotSize": 6500
  },
  "MANAPPURAM": {
    "company": "Manappuram Finance",
    "screener": "https://scanx.trade/company/manappuram-finance-ltd",
    "symbol": "MANAPPURAM",
    "nov2026": 3000,
    "dec2026": 3000,
    "jan2027": 3000,
    "currentLotSize": 3000
  },
  "MANKIND": {
    "company": "Mankind Pharma",
    "screener": "https://scanx.trade/company/mankind-pharma-ltd",
    "symbol": "MANKIND",
    "nov2026": 250,
    "dec2026": 250,
    "jan2027": 250,
    "currentLotSize": 250
  },
  "MARICO": {
    "company": "Marico",
    "screener": "https://scanx.trade/company/marico-ltd",
    "symbol": "MARICO",
    "nov2026": 1200,
    "dec2026": 1200,
    "jan2027": 1200,
    "currentLotSize": 1200
  },
  "MARUTI": {
    "company": "Maruti Suzuki",
    "screener": "https://scanx.trade/company/maruti-suzuki-ltd",
    "symbol": "MARUTI",
    "nov2026": 50,
    "dec2026": 50,
    "jan2027": 50,
    "currentLotSize": 50
  },
  "MAXHEALTH": {
    "company": "Max Healthcare Institute",
    "screener": "https://scanx.trade/company/max-healthcare-institute-ltd",
    "symbol": "MAXHEALTH",
    "nov2026": 525,
    "dec2026": 525,
    "jan2027": 525,
    "currentLotSize": 525
  },
  "MAZDOCK": {
    "company": "Mazagon Dock Shipbuilders",
    "screener": "https://scanx.trade/company/mazagon-dock-shipbuilders-ltd",
    "symbol": "MAZDOCK",
    "nov2026": 225,
    "dec2026": 225,
    "jan2027": 225,
    "currentLotSize": 225
  },
  "MCX": {
    "company": "MCX",
    "screener": "https://scanx.trade/company/multi-commodity-exchange-ltd",
    "symbol": "MCX",
    "nov2026": 225,
    "dec2026": 225,
    "jan2027": 225,
    "currentLotSize": 225
  },
  "MFSL": {
    "company": "Max Financial Services",
    "screener": "https://scanx.trade/company/max-financial-services-ltd",
    "symbol": "MFSL",
    "nov2026": 400,
    "dec2026": 400,
    "jan2027": 400,
    "currentLotSize": 400
  },
  "MOTHERSON": {
    "company": "Samvardhana Motherson International",
    "screener": "https://scanx.trade/company/motherson-sumi-systems-ltd",
    "symbol": "MOTHERSON",
    "nov2026": 6150,
    "dec2026": 6150,
    "jan2027": 6150,
    "currentLotSize": 6150
  },
  "MOTILALOFS": {
    "company": "Motilal Oswal Financial Services",
    "screener": "https://scanx.trade/company/motilal-oswal-financial-services-ltd",
    "symbol": "MOTILALOFS",
    "nov2026": 775,
    "dec2026": 775,
    "jan2027": 775,
    "currentLotSize": 775
  },
  "MPHASIS": {
    "company": "Mphasis",
    "screener": "https://scanx.trade/company/mphasis-ltd",
    "symbol": "MPHASIS",
    "nov2026": 275,
    "dec2026": 275,
    "jan2027": 275,
    "currentLotSize": 275
  },
  "MUTHOOTFIN": {
    "company": "Muthoot Finance",
    "screener": "https://scanx.trade/company/muthoot-finance-ltd",
    "symbol": "MUTHOOTFIN",
    "nov2026": 275,
    "dec2026": 275,
    "jan2027": 275,
    "currentLotSize": 275
  },
  "NAM-INDIA": {
    "company": "Nippon Life India AMC",
    "screener": "https://scanx.trade/company/nippon-life-india-asset-management-ltd",
    "symbol": "NAM-INDIA",
    "nov2026": 625,
    "dec2026": 625,
    "jan2027": 625,
    "currentLotSize": 625
  },
  "NATIONALUM": {
    "company": "NALCO",
    "screener": "https://scanx.trade/company/national-aluminium-company-ltd",
    "symbol": "NATIONALUM",
    "nov2026": 1875,
    "dec2026": 1875,
    "jan2027": 1875,
    "currentLotSize": 1875
  },
  "NAUKRI": {
    "company": "Info Edge",
    "screener": "https://scanx.trade/company/naukri-info-edge-ltd",
    "symbol": "NAUKRI",
    "nov2026": 550,
    "dec2026": 550,
    "jan2027": 550,
    "currentLotSize": 550
  },
  "NAVINFLUOR": {
    "company": "Navin Fluorine International",
    "screener": "https://scanx.trade/company/navin-fluorine-international-ltd",
    "symbol": "NAVINFLUOR",
    "nov2026": 75,
    "dec2026": 75,
    "jan2027": 75,
    "currentLotSize": 75
  },
  "NBCC": {
    "company": "NBCC",
    "screener": "https://scanx.trade/company/nbcc-ltd",
    "symbol": "NBCC",
    "nov2026": 6500,
    "dec2026": 6500,
    "jan2027": 6500,
    "currentLotSize": 6500
  },
  "NESTLEIND": {
    "company": "Nestle",
    "screener": "https://scanx.trade/company/nestle-india-ltd",
    "symbol": "NESTLEIND",
    "nov2026": 500,
    "dec2026": 500,
    "jan2027": 500,
    "currentLotSize": 500
  },
  "NHPC": {
    "company": "NHPC",
    "screener": "https://scanx.trade/company/nhpc-ltd",
    "symbol": "NHPC",
    "nov2026": 6950,
    "dec2026": 6950,
    "jan2027": 6950,
    "currentLotSize": 6950
  },
  "NMDC": {
    "company": "NMDC",
    "screener": "https://scanx.trade/company/nmdc-ltd",
    "symbol": "NMDC",
    "nov2026": 6750,
    "dec2026": 6750,
    "jan2027": 6750,
    "currentLotSize": 6750
  },
  "NTPC": {
    "company": "NTPC",
    "screener": "https://scanx.trade/company/ntpc-ltd",
    "symbol": "NTPC",
    "nov2026": 1500,
    "dec2026": 1500,
    "jan2027": 1600,
    "currentLotSize": 1500
  },
  "NYKAA": {
    "company": "Nykaa",
    "screener": "https://scanx.trade/company/nykaa-ltd",
    "symbol": "NYKAA",
    "nov2026": 3125,
    "dec2026": 3125,
    "jan2027": 1575,
    "currentLotSize": 3125
  },
  "OBEROIRLTY": {
    "company": "Oberoi Realty",
    "screener": "https://scanx.trade/company/oberoi-realty-ltd",
    "symbol": "OBEROIRLTY",
    "nov2026": 350,
    "dec2026": 350,
    "jan2027": 350,
    "currentLotSize": 350
  },
  "OFSS": {
    "company": "Oracle Financial Services Software",
    "screener": "https://scanx.trade/company/oracle-financial-services-software-ltd",
    "symbol": "OFSS",
    "nov2026": 50,
    "dec2026": 50,
    "jan2027": 50,
    "currentLotSize": 50
  },
  "OIL": {
    "company": "Oil India",
    "screener": "https://scanx.trade/company/oil-india-ltd",
    "symbol": "OIL",
    "nov2026": 1400,
    "dec2026": 1400,
    "jan2027": 1400,
    "currentLotSize": 1400
  },
  "ONGC": {
    "company": "Oil & Natural Gas Corporation",
    "screener": "https://scanx.trade/company/oil-natural-gas-corporation-ltd",
    "symbol": "ONGC",
    "nov2026": 2250,
    "dec2026": 2250,
    "jan2027": 2250,
    "currentLotSize": 2250
  },
  "PAGEIND": {
    "company": "Page Industries",
    "screener": "https://scanx.trade/company/page-industries-ltd",
    "symbol": "PAGEIND",
    "nov2026": 20,
    "dec2026": 20,
    "jan2027": 20,
    "currentLotSize": 20
  },
  "PATANJALI": {
    "company": "Patanjali Foods",
    "screener": "https://scanx.trade/company/ruchi-soya-industries-ltd",
    "symbol": "PATANJALI",
    "nov2026": 1075,
    "dec2026": 1075,
    "jan2027": 1450,
    "currentLotSize": 1075
  },
  "PAYTM": {
    "company": "One 97 Communications",
    "screener": "https://scanx.trade/company/paytm-ltd",
    "symbol": "PAYTM",
    "nov2026": 725,
    "dec2026": 725,
    "jan2027": 325,
    "currentLotSize": 725
  },
  "PERSISTENT": {
    "company": "Persistent Systems",
    "screener": "https://scanx.trade/company/persistent-systems-ltd",
    "symbol": "PERSISTENT",
    "nov2026": 125,
    "dec2026": 125,
    "jan2027": 125,
    "currentLotSize": 125
  },
  "PETRONET": {
    "company": "Petronet LNG",
    "screener": "https://scanx.trade/company/petronet-lng-ltd",
    "symbol": "PETRONET",
    "nov2026": 1900,
    "dec2026": 1900,
    "jan2027": 1900,
    "currentLotSize": 1900
  },
  "PFC": {
    "company": "Power Finance Corporation",
    "screener": "https://scanx.trade/company/power-finance-corporation-ltd",
    "symbol": "PFC",
    "nov2026": 1300,
    "dec2026": 1300,
    "jan2027": 1525,
    "currentLotSize": 1300
  },
  "PGEL": {
    "company": "PG Electroplast",
    "screener": "https://scanx.trade/company/pg-electroplast-ltd",
    "symbol": "PGEL",
    "nov2026": 950,
    "dec2026": 950,
    "jan2027": 950,
    "currentLotSize": 950
  },
  "PHOENIXLTD": {
    "company": "Phoenix Mills",
    "screener": "https://scanx.trade/company/phoenix-mills-ltd",
    "symbol": "PHOENIXLTD",
    "nov2026": 350,
    "dec2026": 350,
    "jan2027": 350,
    "currentLotSize": 350
  },
  "PIDILITIND": {
    "company": "Pidilite Industries",
    "screener": "https://scanx.trade/company/pidilite-industries-ltd",
    "symbol": "PIDILITIND",
    "nov2026": 500,
    "dec2026": 500,
    "jan2027": 500,
    "currentLotSize": 500
  },
  "PIIND": {
    "company": "PI Industries",
    "screener": "https://scanx.trade/company/pi-industries-ltd",
    "symbol": "PIIND",
    "nov2026": 175,
    "dec2026": 175,
    "jan2027": 225,
    "currentLotSize": 175
  },
  "PNB": {
    "company": "Punjab National Bank",
    "screener": "https://scanx.trade/company/punjab-national-bank-ltd",
    "symbol": "PNB",
    "nov2026": 8000,
    "dec2026": 8000,
    "jan2027": 8000,
    "currentLotSize": 8000
  },
  "PNBHOUSING": {
    "company": "PNB Housing Finance",
    "screener": "https://scanx.trade/company/pnb-housing-finance-ltd",
    "symbol": "PNBHOUSING",
    "nov2026": 650,
    "dec2026": 650,
    "jan2027": 650,
    "currentLotSize": 650
  },
  "POLICYBZR": {
    "company": "PB FinTech",
    "screener": "https://scanx.trade/company/policy-bazaar-ltd",
    "symbol": "POLICYBZR",
    "nov2026": 350,
    "dec2026": 350,
    "jan2027": 350,
    "currentLotSize": 350
  },
  "POLYCAB": {
    "company": "Polycab",
    "screener": "https://scanx.trade/company/polycab-india-ltd",
    "symbol": "POLYCAB",
    "nov2026": 125,
    "dec2026": 125,
    "jan2027": 75,
    "currentLotSize": 125
  },
  "POWERGRID": {
    "company": "Power Grid Corporation of India",
    "screener": "https://scanx.trade/company/power-grid-corporation-of-india-ltd",
    "symbol": "POWERGRID",
    "nov2026": 1900,
    "dec2026": 1900,
    "jan2027": 1900,
    "currentLotSize": 1900
  },
  "POWERINDIA": {
    "company": "Hitachi Energy",
    "screener": "https://scanx.trade/company/abb-power-products-systems-ltd",
    "symbol": "POWERINDIA",
    "nov2026": 25,
    "dec2026": 25,
    "jan2027": 25,
    "currentLotSize": 25
  },
  "PREMIERENE": {
    "company": "Premier Energies",
    "screener": "https://scanx.trade/company/premier-energies-ltd",
    "symbol": "PREMIERENE",
    "nov2026": 650,
    "dec2026": 650,
    "jan2027": 650,
    "currentLotSize": 650
  },
  "PRESTIGE": {
    "company": "Prestige Estates Projects",
    "screener": "https://scanx.trade/company/prestige-estate-ltd",
    "symbol": "PRESTIGE",
    "nov2026": 450,
    "dec2026": 450,
    "jan2027": 450,
    "currentLotSize": 450
  },
  "RADICO": {
    "company": "Radico Khaitan",
    "screener": "https://scanx.trade/company/radico-khaitan-ltd",
    "symbol": "RADICO",
    "nov2026": 150,
    "dec2026": 150,
    "jan2027": 150,
    "currentLotSize": 150
  },
  "RBLBANK": {
    "company": "RBL Bank",
    "screener": "https://scanx.trade/company/rbl-bank-ltd",
    "symbol": "RBLBANK",
    "nov2026": 3175,
    "dec2026": 3175,
    "jan2027": 1275,
    "currentLotSize": 3175
  },
  "RECLTD": {
    "company": "REC",
    "screener": "https://scanx.trade/company/rural-electrification-corporation-ltd",
    "symbol": "RECLTD",
    "nov2026": 1575,
    "dec2026": 1575,
    "jan2027": 1675,
    "currentLotSize": 1575
  },
  "RELIANCE": {
    "company": "Reliance Industries",
    "screener": "https://scanx.trade/company/reliance-industries-ltd",
    "symbol": "RELIANCE",
    "nov2026": 500,
    "dec2026": 500,
    "jan2027": 500,
    "currentLotSize": 500
  },
  "RVNL": {
    "company": "Rail Vikas Nigam",
    "screener": "https://scanx.trade/company/rail-vikas-nigam-ltd",
    "symbol": "RVNL",
    "nov2026": 1925,
    "dec2026": 1925,
    "jan2027": 2525,
    "currentLotSize": 1925
  },
  "SAGILITY": {
    "company": "Sagility",
    "screener": "https://scanx.trade/company/sagility-india-ltd",
    "symbol": "SAGILITY",
    "nov2026": 12000,
    "dec2026": 12000,
    "jan2027": 12000,
    "currentLotSize": 12000
  },
  "SAIL": {
    "company": "Steel Authority of India",
    "screener": "https://scanx.trade/company/steel-authority-of-india-ltd",
    "symbol": "SAIL",
    "nov2026": 4700,
    "dec2026": 4700,
    "jan2027": 4700,
    "currentLotSize": 4700
  },
  "SBICARD": {
    "company": "SBI Cards",
    "screener": "https://scanx.trade/company/sbi-cards-ltd",
    "symbol": "SBICARD",
    "nov2026": 800,
    "dec2026": 800,
    "jan2027": 800,
    "currentLotSize": 800
  },
  "SBILIFE": {
    "company": "SBI Life Insurance",
    "screener": "https://scanx.trade/company/sbi-life-insurance-ltd",
    "symbol": "SBILIFE",
    "nov2026": 375,
    "dec2026": 375,
    "jan2027": 375,
    "currentLotSize": 375
  },
  "SBIN": {
    "company": "State Bank of India",
    "screener": "https://scanx.trade/company/state-bank-of-india-ltd",
    "symbol": "SBIN",
    "nov2026": 750,
    "dec2026": 750,
    "jan2027": 750,
    "currentLotSize": 750
  },
  "SHREECEM": {
    "company": "Shree Cement",
    "screener": "https://scanx.trade/company/shree-cement-ltd",
    "symbol": "SHREECEM",
    "nov2026": 25,
    "dec2026": 25,
    "jan2027": 25,
    "currentLotSize": 25
  },
  "SHRIRAMFIN": {
    "company": "Shriram Finance",
    "screener": "https://scanx.trade/company/shriram-transport-finance-company-ltd",
    "symbol": "SHRIRAMFIN",
    "nov2026": 825,
    "dec2026": 825,
    "jan2027": 825,
    "currentLotSize": 825
  },
  "SIEMENS": {
    "company": "Siemens",
    "screener": "https://scanx.trade/company/siemens-ltd",
    "symbol": "SIEMENS",
    "nov2026": 175,
    "dec2026": 175,
    "jan2027": 175,
    "currentLotSize": 175
  },
  "SOLARINDS": {
    "company": "Solar Industries",
    "screener": "https://scanx.trade/company/solar-industries-ltd",
    "symbol": "SOLARINDS",
    "nov2026": 25,
    "dec2026": 25,
    "jan2027": 25,
    "currentLotSize": 25
  },
  "SONACOMS": {
    "company": "Sona BLW Precision Forgings",
    "screener": "https://scanx.trade/company/sona-blw-precision-forgings-ltd",
    "symbol": "SONACOMS",
    "nov2026": 1225,
    "dec2026": 1225,
    "jan2027": 1225,
    "currentLotSize": 1225
  },
  "SRF": {
    "company": "SRF",
    "screener": "https://scanx.trade/company/srf-ltd",
    "symbol": "SRF",
    "nov2026": 200,
    "dec2026": 200,
    "jan2027": 200,
    "currentLotSize": 200
  },
  "SUNPHARMA": {
    "company": "Sun Pharmaceutical",
    "screener": "https://scanx.trade/company/sun-pharmaceutical-ltd",
    "symbol": "SUNPHARMA",
    "nov2026": 350,
    "dec2026": 350,
    "jan2027": 350,
    "currentLotSize": 350
  },
  "SUPREMEIND": {
    "company": "Supreme Industries",
    "screener": "https://scanx.trade/company/supreme-industries-ltd",
    "symbol": "SUPREMEIND",
    "nov2026": 175,
    "dec2026": 175,
    "jan2027": 175,
    "currentLotSize": 175
  },
  "SUZLON": {
    "company": "Suzlon Energy",
    "screener": "https://scanx.trade/company/suzlon-ltd",
    "symbol": "SUZLON",
    "nov2026": 12700,
    "dec2026": 12700,
    "jan2027": 12700,
    "currentLotSize": 12700
  },
  "SWIGGY": {
    "company": "Swiggy",
    "screener": "https://scanx.trade/company/swiggy-ltd",
    "symbol": "SWIGGY",
    "nov2026": 1825,
    "dec2026": 1825,
    "jan2027": 1925,
    "currentLotSize": 1825
  },
  "SYRMA": {
    "company": "Syrma SGS",
    "screener": "https://scanx.trade/company/syrma-sgs-ltd",
    "symbol": "SYRMA",
    "nov2026": 325,
    "dec2026": 325,
    "jan2027": 325,
    "currentLotSize": 325
  },
  "TATACONSUM": {
    "company": "Tata Consumer Products",
    "screener": "https://scanx.trade/company/tata-consumer-products-ltd",
    "symbol": "TATACONSUM",
    "nov2026": 550,
    "dec2026": 550,
    "jan2027": 550,
    "currentLotSize": 550
  },
  "TATAELXSI": {
    "company": "Tata Elxsi",
    "screener": "https://scanx.trade/company/tata-elxsi-ltd",
    "symbol": "TATAELXSI",
    "nov2026": 125,
    "dec2026": 125,
    "jan2027": 175,
    "currentLotSize": 125
  },
  "TATAPOWER": {
    "company": "Tata Power",
    "screener": "https://scanx.trade/company/tata-power-ltd",
    "symbol": "TATAPOWER",
    "nov2026": 1450,
    "dec2026": 1450,
    "jan2027": 1450,
    "currentLotSize": 1450
  },
  "TATASTEEL": {
    "company": "Tata Steel",
    "screener": "https://scanx.trade/company/tata-steel-ltd",
    "symbol": "TATASTEEL",
    "nov2026": 2750,
    "dec2026": 2750,
    "jan2027": 2750,
    "currentLotSize": 2750
  },
  "TCS": {
    "company": "Tata Consultancy Services",
    "screener": "https://scanx.trade/company/tcs-tata-consultancy-services-ltd",
    "symbol": "TCS",
    "nov2026": 225,
    "dec2026": 225,
    "jan2027": 250,
    "currentLotSize": 225
  },
  "TECHM": {
    "company": "Tech Mahindra",
    "screener": "https://scanx.trade/company/tech-mahindra-ltd",
    "symbol": "TECHM",
    "nov2026": 600,
    "dec2026": 600,
    "jan2027": 600,
    "currentLotSize": 600
  },
  "TIINDIA": {
    "company": "Tube Investment",
    "screener": "https://scanx.trade/company/tube-invest-of-india-ltd",
    "symbol": "TIINDIA",
    "nov2026": 200,
    "dec2026": 200,
    "jan2027": 200,
    "currentLotSize": 200
  },
  "TITAN": {
    "company": "Titan",
    "screener": "https://scanx.trade/company/titan-ltd",
    "symbol": "TITAN",
    "nov2026": 175,
    "dec2026": 175,
    "jan2027": 175,
    "currentLotSize": 175
  },
  "TMPV": {
    "company": "Tata Motors Passenger Vehicles",
    "screener": "https://scanx.trade/company/tata-motors-passenger-vehicles-ltd",
    "symbol": "TMPV",
    "nov2026": 1600,
    "dec2026": 1600,
    "jan2027": 1750,
    "currentLotSize": 1600
  },
  "TORNTPHARM": {
    "company": "Torrent Pharmaceuticals",
    "screener": "https://scanx.trade/company/torrent-pharmaceuticals-ltd",
    "symbol": "TORNTPHARM",
    "nov2026": 125,
    "dec2026": 125,
    "jan2027": 125,
    "currentLotSize": 125
  },
  "TRENT": {
    "company": "Trent",
    "screener": "https://scanx.trade/company/trent-ltd",
    "symbol": "TRENT",
    "nov2026": 225,
    "dec2026": 225,
    "jan2027": 225,
    "currentLotSize": 225
  },
  "TVSMOTOR": {
    "company": "TVS Motors",
    "screener": "https://scanx.trade/company/tvs-motors-ltd",
    "symbol": "TVSMOTOR",
    "nov2026": 175,
    "dec2026": 175,
    "jan2027": 175,
    "currentLotSize": 175
  },
  "UJJIVANSFB": {
    "company": "Ujjivan Small Finance Bank",
    "screener": "https://scanx.trade/company/ujjivan-small-finance-bank-ltd",
    "symbol": "UJJIVANSFB",
    "nov2026": 8000,
    "dec2026": 8000,
    "jan2027": 8000,
    "currentLotSize": 8000
  },
  "ULTRACEMCO": {
    "company": "UltraTech Cement",
    "screener": "https://scanx.trade/company/ultratech-cement-ltd",
    "symbol": "ULTRACEMCO",
    "nov2026": 50,
    "dec2026": 50,
    "jan2027": 50,
    "currentLotSize": 50
  },
  "UNIONBANK": {
    "company": "Union Bank of India",
    "screener": "https://scanx.trade/company/union-bank-of-india-ltd",
    "symbol": "UNIONBANK",
    "nov2026": 4425,
    "dec2026": 4425,
    "jan2027": 4425,
    "currentLotSize": 4425
  },
  "UNITDSPR": {
    "company": "United Spirits",
    "screener": "https://scanx.trade/company/united-spirits-ltd",
    "symbol": "UNITDSPR",
    "nov2026": 400,
    "dec2026": 400,
    "jan2027": 400,
    "currentLotSize": 400
  },
  "UNOMINDA": {
    "company": "UNO Minda",
    "screener": "https://scanx.trade/company/minda-industries-ltd",
    "symbol": "UNOMINDA",
    "nov2026": 550,
    "dec2026": 550,
    "jan2027": 550,
    "currentLotSize": 550
  },
  "UPL": {
    "company": "UPL",
    "screener": "https://scanx.trade/company/upl-united-phosphorus-ltd",
    "symbol": "UPL",
    "nov2026": 1355,
    "dec2026": 1355,
    "jan2027": 1355,
    "currentLotSize": 1355
  },
  "VBL": {
    "company": "Varun Beverages",
    "screener": "https://scanx.trade/company/varun-beverages-ltd",
    "symbol": "VBL",
    "nov2026": 1275,
    "dec2026": 1275,
    "jan2027": 1275,
    "currentLotSize": 1275
  },
  "VEDL": {
    "company": "Vedanta",
    "screener": "https://scanx.trade/company/vedanta-ltd",
    "symbol": "VEDL",
    "nov2026": 1150,
    "dec2026": 1150,
    "jan2027": 1975,
    "currentLotSize": 1150
  },
  "VMM": {
    "company": "Vishal Mega Mart",
    "screener": "https://scanx.trade/company/vishal-mega-mart-ltd",
    "symbol": "VMM",
    "nov2026": 4850,
    "dec2026": 4850,
    "jan2027": 4850,
    "currentLotSize": 4850
  },
  "VOLTAS": {
    "company": "Voltas",
    "screener": "https://scanx.trade/company/voltas-ltd",
    "symbol": "VOLTAS",
    "nov2026": 375,
    "dec2026": 375,
    "jan2027": 475,
    "currentLotSize": 375
  },
  "WAAREEENER": {
    "company": "Waaree Energies",
    "screener": "https://scanx.trade/company/waaree-energies-ltd",
    "symbol": "WAAREEENER",
    "nov2026": 175,
    "dec2026": 175,
    "jan2027": 225,
    "currentLotSize": 175
  },
  "WIPRO": {
    "company": "Wipro",
    "screener": "https://scanx.trade/company/wipro-ltd",
    "symbol": "WIPRO",
    "nov2026": 3000,
    "dec2026": 3000,
    "jan2027": 3000,
    "currentLotSize": 3000
  },
  "YESBANK": {
    "company": "Yes Bank",
    "screener": "https://scanx.trade/company/yes-bank-ltd",
    "symbol": "YESBANK",
    "nov2026": 31100,
    "dec2026": 31100,
    "jan2027": 31100,
    "currentLotSize": 31100
  },
  "ZYDUSLIFE": {
    "company": "Zydus Life Science",
    "screener": "https://scanx.trade/company/cadila-healthcare-ltd",
    "symbol": "ZYDUSLIFE",
    "nov2026": 450,
    "dec2026": 450,
    "jan2027": 450,
    "currentLotSize": 450
  }
};

function getLotSize(symbol, expiryDateOrMonth) {
  if (!symbol) return 65;
  const clean = String(symbol)
    .toUpperCase()
    .replace(/^(NSE:|BSE:|MCX:)/, '')
    .replace(/[0-9]+(CE|PE)$/, '')
    .replace(/1!$/, '')
    .trim();

  // Commodity overrides
  if (clean.includes('CRUDE')) return 100;
  if (clean.includes('NATURALGAS')) return 1250;
  if (clean.includes('GOLD')) return 100;
  if (clean.includes('SILVER')) return 30;

  const entry = LOT_SIZES_MAP[clean];
  if (!entry) {
    if (clean.includes('BANKNIFTY')) return 30;
    if (clean.includes('FINNIFTY')) return 60;
    if (clean.includes('MIDCPNIFTY')) return 120;
    if (clean.includes('NIFTY')) return 65;
    return 500;
  }

  // Month check if provided
  const expStr = String(expiryDateOrMonth || '').toUpperCase();
  if (expStr.includes('JAN') || expStr.startsWith('2701') || expStr.includes('2027-01')) {
    return entry.jan2027 || entry.currentLotSize;
  }
  if (expStr.includes('DEC') || expStr.startsWith('2612') || expStr.includes('2026-12')) {
    return entry.dec2026 || entry.currentLotSize;
  }
  return entry.nov2026 || entry.currentLotSize;
}

export {
  LOT_SIZES_MAP,
  getLotSize
};

export default {
  LOT_SIZES_MAP,
  getLotSize
};
