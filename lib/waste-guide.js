/**
 * WasteLoop — Smart Waste Disposal Guide data set
 *
 * A plain JavaScript array of objects (no database). The browser search uses
 * filter()/find() on this array, and GET /api/waste-guide serves the same data
 * so the frontend and the API always agree.
 */

'use strict';

const WASTE_GUIDE = [
  {
    id: 'plastic-bottle',
    item: 'Plastic Bottle',
    wasteType: 'Plastic Waste',
    recyclable: true,
    recommendedAction:
      'Rinse the bottle, remove the cap and label, then hand it over to an authorised plastic recycler or a plastic collection centre.',
    greenPointsPerKg: 8,
    warning: 'Do not burn or bury plastic bottles. Replace single-use bottles with reusable ones.',
    keywords: ['plastic', 'bottle', 'pet', 'water', 'cold drink', 'soft drink', 'mineral water'],
    stream: 'Dry Waste — Blue Bin'
  },
  {
    id: 'newspaper',
    item: 'Newspaper',
    wasteType: 'Paper Waste',
    recyclable: true,
    recommendedAction:
      'Bundle newspapers neatly, keep them dry and place them in the paper collection bin or hand them to a scrap dealer.',
    greenPointsPerKg: 12,
    warning: 'Wet paper cannot be recycled. Store newspapers in a dry place until collection.',
    keywords: ['newspaper', 'paper', 'news', 'daily', 'journal', 'magazine', 'press'],
    stream: 'Dry Waste — Blue Bin'
  },
  {
    id: 'mobile-phone',
    item: 'Mobile Phone',
    wasteType: 'Electronic Waste',
    recyclable: true,
    recommendedAction:
      'Take it to an authorised e-waste collection centre or hand it over at a WasteLoop e-waste kiosk for certified data wiping.',
    greenPointsPerKg: 25,
    warning: 'Never throw a mobile phone with household waste. Remove personal data before handing it over.',
    keywords: ['mobile', 'phone', 'smartphone', 'cell phone', 'handset', 'old mobile', 'tablet', 'charger'],
    stream: 'E-Waste Drop-off'
  },
  {
    id: 'glass-bottle',
    item: 'Glass Bottle',
    wasteType: 'Glass Waste',
    recyclable: true,
    recommendedAction:
      'Empty and rinse the bottle, remove metal or plastic caps, and drop it at a glass recycling centre without breaking it.',
    greenPointsPerKg: 5,
    warning: 'Broken glass must be wrapped in cloth and labelled before disposal to protect waste workers.',
    keywords: ['glass', 'bottle', 'jar', 'wine', 'beer', 'syrup'],
    stream: 'Dry Waste — Green Bin'
  },
  {
    id: 'aluminium-can',
    item: 'Aluminium Can',
    wasteType: 'Metal Waste',
    recyclable: true,
    recommendedAction:
      'Crush the can gently, rinse it and deposit it in a metal collection bin or return it to a scrap recycler.',
    greenPointsPerKg: 45,
    warning: 'Do not keep aluminium cans for long periods — they are easily damaged and lose recycling value.',
    keywords: ['aluminium', 'aluminum', 'can', 'metal', 'beer can', 'cold drink can', 'tin'],
    stream: 'Dry Waste — Grey Bin'
  },
  {
    id: 'clothes',
    item: 'Clothes',
    wasteType: 'Cloth Waste',
    recyclable: true,
    recommendedAction:
      'Donate clean, wearable clothes to a collection drive, or hand them to a certified cloth recycler for shredding and fibre reuse.',
    greenPointsPerKg: 6,
    warning: 'Wet or soiled clothes cannot be recycled and should go to the wet waste compost stream.',
    keywords: ['clothes', 'clothing', 'cloth', 'garment', 'saree', 'shirt', 'trousers', 'old clothes', 'textile'],
    stream: 'Dry Waste — Donate or Recycle'
  },
  {
    id: 'battery',
    item: 'Battery',
    wasteType: 'Hazardous Waste',
    recyclable: false,
    recommendedAction:
      'Tape the terminals, store the battery in a cool dry box, and deposit it at an authorised battery collection point or hazardous waste centre.',
    greenPointsPerKg: 15,
    warning:
      'Hazardous. Never throw batteries in household waste — they can cause fires in collection vehicles. Damaged or leaking batteries must be reported to the helpline.',
    keywords: ['battery', 'batteries', 'cell', 'lithium', 'charger', 'laptop battery', 'inverter battery', 'swollen battery'],
    stream: 'Hazardous Waste — Separate Bin'
  },
  {
    id: 'cardboard',
    item: 'Cardboard',
    wasteType: 'Paper Waste',
    recyclable: true,
    recommendedAction:
      'Flatten the cardboard, remove plastic tape and stickers, and tie it in a bundle for paper recycling.',
    greenPointsPerKg: 9,
    warning: 'Cardboard soaked in water or oil cannot be recycled. Keep it dry and free of food waste.',
    keywords: ['cardboard', 'carton', 'box', 'packing', 'corrugated', 'shipping', 'egg tray'],
    stream: 'Dry Waste — Blue Bin'
  },
  {
    id: 'food-waste',
    item: 'Food Waste',
    wasteType: 'Wet / Organic Waste',
    recyclable: true,
    recommendedAction:
      'Segregate it at home, store it in a lidded container and give it for daily composting or biogas plant processing.',
    greenPointsPerKg: 3,
    warning: 'Mixing food waste with dry waste contaminates recyclables and sends them to landfill.',
    keywords: ['food', 'waste food', 'kitchen', 'vegetable', 'fruit', 'organic', 'leftover', 'rotten', 'compost'],
    stream: 'Wet Waste — Green Bin'
  },
  {
    id: 'electronic-waste',
    item: 'Electronic Waste',
    wasteType: 'Electronic Waste',
    recyclable: true,
    recommendedAction:
      'Drop the device at an authorised e-waste collection centre for dismantling, or apply to a registered recycler through this portal.',
    greenPointsPerKg: 22,
    warning: 'Do not dispose electronics with household waste. They release lead, mercury and cadmium.',
    keywords: ['electronic', 'electronics', 'ewaste', 'e-waste', 'television', 'tv', 'laptop', 'computer', 'printer', 'monitor', 'refrigerator', 'washer', 'microwave'],
    stream: 'E-Waste Drop-off'
  },
  {
    id: 'sanitary-waste',
    item: 'Sanitary Waste (Diaper / Pads)',
    wasteType: 'Hazardous / Domestic Bio-waste',
    recyclable: false,
    recommendedAction:
      'Wrap the item in a sealed bag and hand it to a WasteLoop sanitation waste collection point or an authorised biomedical waste collector.',
    greenPointsPerKg: 0,
    warning:
      'Never flush or bury sanitary waste. Keep it separate from kitchen waste to protect composting workers.',
    keywords: ['sanitary', 'diaper', 'pads', 'tissue', 'soiled', 'menstrual', 'cotton', 'medical waste'],
    stream: 'Hazardous / Sanitation Bin'
  },
  {
    id: 'plastic-bag',
    item: 'Plastic Bag',
    wasteType: 'Plastic Waste',
    recyclable: false,
    recommendedAction:
      'Hand over loosely rolled plastic bags at a WasteLoop collection counter or a registered recycler that handles film plastic.',
    greenPointsPerKg: 4,
    warning:
      'Thin film plastic chokes recycling machinery and drains. Never put plastic bags into the dry waste bin for regular collection.',
    keywords: ['plastic bag', 'poly bag', 'carry bag', 'grocery bag', 'polythene', 'wrapper', 'packaging film'],
    stream: 'Special Collection'
  }
];

/** Complaint / grievance categories shared by the portal and the API. */
const COMPLAINT_TYPES = [
  'Pickup Delay',
  'Missed Pickup',
  'Incorrect Collection',
  'Collector Behaviour',
  'Waste Not Collected',
  'Other'
];

const CONTACT_METHODS = ['Phone Call', 'SMS', 'Email', 'WhatsApp'];

const WASTE_CATEGORIES = [
  'Dry Waste',
  'Wet Waste',
  'Plastic Waste',
  'Paper Waste',
  'Metal Waste',
  'Glass Waste',
  'E-Waste',
  'Hazardous Waste'
];

/**
 * Partial / fuzzy search used by GET /api/waste-guide?q=phone
 * "phone" must match "Mobile Phone" because keywords are searched too.
 */
function searchWasteGuide(query) {
  const term = String(query || '').trim().toLowerCase();
  if (!term) return WASTE_GUIDE;
  return WASTE_GUIDE.filter((entry) => {
    const haystack = [entry.item, entry.wasteType, entry.stream, ...entry.keywords]
      .join(' ')
      .toLowerCase();
    return haystack.includes(term);
  });
}

module.exports = {
  WASTE_GUIDE,
  COMPLAINT_TYPES,
  CONTACT_METHODS,
  WASTE_CATEGORIES,
  searchWasteGuide
};