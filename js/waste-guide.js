/**
 * WasteLoop — Feature 2: Smart Waste Disposal Guide
 *
 * The citizen types an item ("phone", "old mobile", "plastic bottle", ...) and
 * the guide explains how to dispose of it.
 *
 * The waste information is a plain JavaScript ARRAY OF OBJECTS. The page uses
 * find(), filter(), map(), sort() and event listeners, then paints the answer
 * with DOM manipulation — no template engine.
 *
 * The same dataset is served by GET /api/waste-guide so the browser and the
 * backend always answer identically. The API is used when it is reachable and
 * the local array is used as the offline fallback.
 */

(function () {
  /* ------------------------------------------------------------------
     Fallback copy of lib/waste-guide.js, kept in sync with the API.
     ------------------------------------------------------------------ */
  var LOCAL_GUIDE = [
    {
      id: 'plastic-bottle',
      item: 'Plastic Bottle',
      wasteType: 'Plastic Waste',
      recyclable: true,
      recommendedAction: 'Rinse the bottle, remove the cap and label, then hand it over to an authorised plastic recycler or a plastic collection centre.',
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
      recommendedAction: 'Bundle newspapers neatly, keep them dry and place them in the paper collection bin or hand them to a scrap dealer.',
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
      recommendedAction: 'Take it to an authorised e-waste collection centre or hand it over at a WasteLoop e-waste kiosk for certified data wiping.',
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
      recommendedAction: 'Empty and rinse the bottle, remove metal or plastic caps, and drop it at a glass recycling centre without breaking it.',
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
      recommendedAction: 'Crush the can gently, rinse it and deposit it in a metal collection bin or return it to a scrap recycler.',
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
      recommendedAction: 'Donate clean, wearable clothes to a collection drive, or hand them to a certified cloth recycler for shredding and fibre reuse.',
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
      recommendedAction: 'Tape the terminals, store the battery in a cool dry box, and deposit it at an authorised battery collection point or hazardous waste centre.',
      greenPointsPerKg: 15,
      warning: 'Hazardous. Never throw batteries in household waste — they can cause fires in collection vehicles. Damaged or leaking batteries must be reported to the helpline.',
      keywords: ['battery', 'batteries', 'cell', 'lithium', 'charger', 'laptop battery', 'inverter battery', 'swollen battery'],
      stream: 'Hazardous Waste — Separate Bin'
    },
    {
      id: 'cardboard',
      item: 'Cardboard',
      wasteType: 'Paper Waste',
      recyclable: true,
      recommendedAction: 'Flatten the cardboard, remove plastic tape and stickers, and tie it in a bundle for paper recycling.',
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
      recommendedAction: 'Segregate it at home, store it in a lidded container and give it for daily composting or biogas plant processing.',
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
      recommendedAction: 'Drop the device at an authorised e-waste collection centre for dismantling, or apply to a registered recycler through this portal.',
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
      recommendedAction: 'Wrap the item in a sealed bag and hand it to a WasteLoop sanitation waste collection point or an authorised biomedical waste collector.',
      greenPointsPerKg: 0,
      warning: 'Never flush or bury sanitary waste. Keep it separate from kitchen waste to protect composting workers.',
      keywords: ['sanitary', 'diaper', 'pads', 'tissue', 'soiled', 'menstrual', 'cotton', 'medical waste'],
      stream: 'Hazardous / Sanitation Bin'
    },
    {
      id: 'plastic-bag',
      item: 'Plastic Bag',
      wasteType: 'Plastic Waste',
      recyclable: false,
      recommendedAction: 'Hand over loosely rolled plastic bags at a WasteLoop collection counter or a registered recycler that handles film plastic.',
      greenPointsPerKg: 4,
      warning: 'Thin film plastic chokes recycling machinery and drains. Never put plastic bags into the dry waste bin for regular collection.',
      keywords: ['plastic bag', 'poly bag', 'carry bag', 'grocery bag', 'polythene', 'wrapper', 'packaging film'],
      stream: 'Special Collection'
    }
  ];

  var els = {
    form: document.getElementById('guide-form'),
    input: document.getElementById('guide-query'),
    chips: document.getElementById('guide-chips'),
    result: document.getElementById('guide-result'),
    message: document.getElementById('guide-message'),
    list: document.getElementById('guide-list')
  };

  var guide = LOCAL_GUIDE.slice();

  /* ------------------------------------------------------------------
     Search
     ------------------------------------------------------------------ */

  /**
   * Partial search across the item name, the waste type, the segregation
   * stream and every keyword. This is why "phone" finds "Mobile Phone".
   */
  function searchLocal(query) {
    var term = String(query || '').trim().toLowerCase();
    if (!term) return [];

    return guide.filter(function (entry) {
      var haystack = [entry.item, entry.wasteType, entry.stream]
        .concat(entry.keywords)
        .join(' ')
        .toLowerCase();
      return haystack.indexOf(term) !== -1;
    });
  }

  /* ------------------------------------------------------------------
     Rendering
     ------------------------------------------------------------------ */

  function fact(label, value) {
    var box = document.createElement('div');
    box.className = 'guide-fact';
    var caption = document.createElement('span');
    var strong = document.createElement('strong');
    caption.textContent = label;
    strong.textContent = value;
    box.appendChild(caption);
    box.appendChild(strong);
    return box;
  }

  function clearResult() {
    if (!els.result) return;
    els.result.innerHTML = '';
    els.result.hidden = true;
  }

  function renderEntry(entry, others) {
    els.result.innerHTML = '';
    els.result.hidden = false;

    var title = document.createElement('h2');
    title.textContent = entry.item;
    els.result.appendChild(title);

    var sub = document.createElement('p');
    sub.className = 'guide-sub';
    sub.textContent = 'Segregation stream: ' + entry.stream;
    els.result.appendChild(sub);

    // Waste Type / Recyclable / Green Points
    var facts = document.createElement('div');
    facts.className = 'guide-facts';
    facts.appendChild(fact('Waste Type', entry.wasteType));
    facts.appendChild(fact('Recyclable', entry.recyclable ? 'Yes' : 'No'));
    facts.appendChild(fact('Green Points', entry.greenPointsPerKg + ' points/kg'));
    els.result.appendChild(facts);

    // Recommended action
    var action = document.createElement('p');
    action.className = 'guide-action';
    var actionLabel = document.createElement('strong');
    actionLabel.textContent = 'Recommended Action';
    var actionText = document.createElement('span');
    actionText.textContent = entry.recommendedAction;
    action.appendChild(actionLabel);
    action.appendChild(actionText);
    els.result.appendChild(action);

    // Warning
    var warning = document.createElement('p');
    warning.className = 'guide-warning';
    var warningLabel = document.createElement('strong');
    warningLabel.textContent = 'Warning';
    var warningText = document.createElement('span');
    warningText.textContent = entry.warning;
    warning.appendChild(warningLabel);
    warning.appendChild(warningText);
    els.result.appendChild(warning);

    // Other items that also matched
    if (others.length) {
      var relatedLabel = document.createElement('p');
      relatedLabel.className = 'guide-sub';
      relatedLabel.style.margin = '18px 0 0';
      relatedLabel.textContent = 'Other matching items:';
      els.result.appendChild(relatedLabel);

      var chips = document.createElement('div');
      chips.className = 'guide-chip-row';
      others.forEach(function (other) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'guide-chip';
        chip.textContent = other.item;
        chip.addEventListener('click', function () {
          els.input.value = other.item;
          runSearch(other.item);
        });
        chips.appendChild(chip);
      });
      els.result.appendChild(chips);
    }
  }

  function renderEmpty(query) {
    els.result.innerHTML = '';
    els.result.hidden = false;

    var title = document.createElement('h2');
    title.textContent = 'No matching waste type found';
    els.result.appendChild(title);

    var sub = document.createElement('p');
    sub.className = 'guide-sub';
    sub.textContent =
      'WasteLoop has no disposal entry for "' +
      query +
      '". Try a broader word such as plastic, paper, glass, metal, battery or food.';
    els.result.appendChild(sub);

    var chips = document.createElement('div');
    chips.className = 'guide-chip-row';

    guide
      .slice()
      .sort(function (a, b) {
        return a.item.localeCompare(b.item);
      })
      .slice(0, 8)
      .forEach(function (entry) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'guide-chip';
        chip.textContent = entry.item;
        chip.addEventListener('click', function () {
          els.input.value = entry.item;
          runSearch(entry.item);
        });
        chips.appendChild(chip);
      });

    els.result.appendChild(chips);
  }

  function renderAll() {
    els.result.innerHTML = '';
    els.result.hidden = false;

    var title = document.createElement('h2');
    title.textContent = 'Common Waste Items';
    els.result.appendChild(title);

    var sub = document.createElement('p');
    sub.className = 'guide-sub';
    sub.textContent =
      'Search above for a specific item, or choose one of these ' + guide.length + ' disposal entries.';
    els.result.appendChild(sub);

    var chips = document.createElement('div');
    chips.className = 'guide-chip-row';
    guide
      .slice()
      .sort(function (a, b) {
        return a.item.localeCompare(b.item);
      })
      .forEach(function (entry) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'guide-chip';
        chip.textContent = entry.item;
        chip.addEventListener('click', function () {
          els.input.value = entry.item;
          runSearch(entry.item);
        });
        chips.appendChild(chip);
      });
    els.result.appendChild(chips);
  }

  function renderSidebar() {
    if (!els.list) return;
    els.list.innerHTML = '';

    guide
      .slice()
      .sort(function (a, b) {
        return a.item.localeCompare(b.item);
      })
      .forEach(function (entry) {
        var item = document.createElement('li');
        item.textContent = entry.item + ' — ' + entry.wasteType;
        els.list.appendChild(item);
      });
  }

  function renderQuickChips() {
    if (!els.chips) return;
    ['Plastic bottle', 'Newspaper', 'Mobile phone', 'Glass bottle', 'Battery', 'Food waste'].forEach(
      function (item) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'guide-chip';
        chip.textContent = item;
        chip.addEventListener('click', function () {
          els.input.value = item;
          runSearch(item);
        });
        els.chips.appendChild(chip);
      }
    );
  }

  /* ------------------------------------------------------------------
     Searching — local first (instant), API second (authoritative).
     ------------------------------------------------------------------ */
  function runSearch(query) {
    var term = String(query || '').trim();
    if (!term) {
      clearResult();
      renderAll();
      return;
    }

    var matches = searchLocal(term);

    if (!matches.length) {
      renderEmpty(term);
      return;
    }

    // The first match is the headline answer, the rest are listed below it.
    renderEntry(matches[0], matches.slice(1));
  }

  /* ------------------------------------------------------------------
     Events
     ------------------------------------------------------------------ */

  if (els.form) {
    els.form.addEventListener('submit', function (event) {
      event.preventDefault();
      runSearch(els.input.value);
    });
  }

  // Search as the citizen types (partial search), after a short pause.
  var typeTimer = null;
  if (els.input) {
    els.input.addEventListener('input', function () {
      if (typeTimer) clearTimeout(typeTimer);
      typeTimer = setTimeout(function () {
        runSearch(els.input.value);
      }, 180);
    });
  }

  renderQuickChips();
  renderSidebar();
  renderAll();

  // Load the authoritative dataset from the API on start-up.
  WasteLoopApi.getWasteGuide()
    .then(function (data) {
      if (data.items && data.items.length) {
        guide = data.items;
        renderSidebar();
      }
    })
    .catch(function () {
      /* keep the local array */
    });

  // Exposed so the deep link ?q=phone works too.
  var initialQuery = new URLSearchParams(window.location.search).get('q');
  if (initialQuery) {
    els.input.value = initialQuery;
    runSearch(initialQuery);
  }
})();
