-- Keyword lists for the keyword-fallback classifier (docs/AI.md). English, Hindi and Marathi
-- (Devanagari) plus romanised forms. Matched as lower-cased substrings, so stems are enough.
-- Departments and categories themselves come from 01_workflow.sql.

update categories set keywords = v.kw from (values
  ('water_leak', array[
    'leak', 'leakage', 'leaking', 'pipe burst', 'burst pipe', 'pipeline broken', 'water flowing', 'water wasting',
    'रिसाव', 'लीक', 'पाइप फट', 'पाइपलाइन फट', 'पानी बह', 'पानी बर्बाद',
    'गळती', 'गळतंय', 'गळत आहे', 'पाणी गळ', 'पाईप फुट', 'पाइप फुट', 'पाणी वाया',
    'pani gal', 'galti', 'galtay', 'pipe phut', 'paani beh', 'paani bah', 'risav']),
  ('no_water_supply', array[
    'no water', 'water not coming', 'no supply', 'water supply stopped', 'dry tap', 'low pressure', 'water cut',
    'पानी नहीं', 'पानी नहीं आ', 'पानी नही', 'नल सूखा', 'पानी की सप्लाई', 'पानी बंद',
    'पाणी नाही', 'पाणी येत नाही', 'पाणीपुरवठा बंद', 'नळ कोरडा', 'पाणी आले नाही', 'पाणी कमी दाबाने',
    'pani nahi', 'paani nahi', 'pani yet nahi', 'nal sukha', 'pani band']),
  ('garbage_not_collected', array[
    'garbage', 'trash', 'waste', 'rubbish', 'dustbin', 'not collected', 'garbage truck', 'litter', 'dump',
    'कचरा', 'कूड़ा', 'कूड़ेदान', 'गंदगी', 'कचरा गाड़ी',
    'कचरा उचलला नाही', 'कचऱ्याचा ढीग', 'घंटागाडी', 'कचराकुंडी', 'घाण',
    'kachra', 'kachara', 'kooda', 'kuda', 'ghantagadi']),
  ('streetlight_out', array[
    'streetlight', 'street light', 'street lamp', 'light not working', 'lamp post', 'pole light', 'dark road', 'bulb fused',
    'स्ट्रीटलाइट', 'स्ट्रीट लाइट', 'बत्ती बंद', 'खंभे की लाइट', 'अंधेरा',
    'पथदिवा', 'पथदिवे', 'दिवा बंद', 'खांबावरचा दिवा', 'अंधार', 'लाईट बंद',
    'batti band', 'light band', 'pathdiva', 'andhar', 'andhera']),
  ('pothole', array[
    'pothole', 'pot hole', 'road damaged', 'broken road', 'crater', 'road crack', 'uneven road',
    'गड्ढा', 'गड्ढे', 'सड़क टूटी', 'टूटी सड़क', 'सड़क खराब',
    'खड्डा', 'खड्डे', 'रस्ता खराब', 'रस्ता फुटला', 'रस्त्यावर खड्डा',
    'gaddha', 'gadda', 'khadda', 'khadde', 'rasta kharab', 'sadak kharab']),
  ('drainage_overflow', array[
    'drain', 'drainage', 'sewage', 'sewer', 'gutter', 'overflow', 'manhole', 'blocked drain', 'dirty water', 'nala',
    'नाली', 'नाला', 'सीवर', 'गटर', 'गंदा पानी', 'नाली जाम', 'मैनहोल',
    'गटार', 'गटार तुंबले', 'ड्रेनेज', 'सांडपाणी', 'मॅनहोल', 'घाण पाणी', 'नाला तुंबला',
    'gatar', 'gutter bhar', 'naali', 'nali', 'sandpani', 'tumbla']),
  ('stray_animals', array[
    'stray dog', 'stray dogs', 'dog bite', 'stray', 'cattle', 'cow on road', 'monkey', 'pigs', 'animal',
    'आवारा कुत्ते', 'आवारा', 'कुत्ते', 'कुत्ता', 'कुत्ते ने काटा', 'गाय', 'बंदर', 'सूअर', 'जानवर',
    'भटकी कुत्री', 'भटके कुत्रे', 'कुत्रे', 'कुत्रा', 'कुत्रा चावला', 'जनावरे', 'माकड', 'डुक्कर', 'गुरे',
    'kutte', 'kutta', 'kutra', 'kutri', 'bhatke', 'awara', 'aawara', 'janwar', 'makad']),
  ('other', array[]::text[])
) v(code, kw)
where categories.code = v.code;
