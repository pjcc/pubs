/**
 * Pubs - Apps Script Backend
 *
 * Deploy as a web app:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Before deploying, set script properties (Project Settings > Script Properties):
 *   PASSWORD        - shared app password
 *   PLACES_API_KEY  - Google Places API key
 */

function getPassword() {
  return PropertiesService.getScriptProperties().getProperty('PASSWORD') || '';
}

function getPlacesApiKey() {
  return PropertiesService.getScriptProperties().getProperty('PLACES_API_KEY') || '';
}

// Rate limiting: max failed password attempts per minute
const MAX_FAILED_ATTEMPTS = 5;

const PUBS_SHEET = 'Pubs';
const CATEGORIES_SHEET = 'Categories';
const HISTORY_SHEET = 'History';

const PUB_HEADERS = [
  'Name', 'Area', 'Google Maps Link', 'Google Maps Rating',
  'Tags', 'Food', 'Opening Hours', 'Notes', 'Extra Info', 'Added By', 'Last Updated'
];

const CATEGORY_HEADERS = ['Name', 'Color'];
const HISTORY_HEADERS = ['Timestamp', 'User', 'Action', 'Pub', 'Summary'];

var DEFAULT_CATEGORIES = [
  ['Garden', '#4caf50'],
  ['Terrace', '#ff9800'],
  ['Covered Outdoor', '#7986cb'],
  ['Heaters', '#ef5350'],
  ['Dog Friendly', '#a1887f'],
  ['PUBBL', '#ffd54f'],
  ['Live Music', '#ab47bc'],
  ['Cocktails', '#e91e63'],
  ['Real Ale', '#795548'],
  ['Sports TV', '#2196f3'],
  ['Rooftop', '#00bcd4'],
  ['Seafront', '#0097a7'],
  ['Quiz Night', '#9c27b0'],
  ['Sunday Roast', '#ff5722'],
  ['Late Night', '#3f51b5'],
  ['Cosy', '#8d6e63'],
  ['Family Friendly', '#66bb6a'],
  ['Wheelchair Accessible', '#78909c'],
  ['Reservable', '#5c6bc0'],
  ['Vegetarian Options', '#8bc34a'],
  ['Wine Bar', '#722f37'],
  ['Chilled Reds', '#b71c1c'],
  ['Late Sun', '#ff7043'],
];

// ---- Entry Points ----

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var result = handleRequest(payload);
    return respond(result);
  } catch (err) {
    return respond({ ok: false, error: err.message });
  }
}

function doGet(e) {
  return respond({ ok: false, error: 'Use POST' });
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---- Rate Limiting ----

function isRateLimited() {
  var cache = CacheService.getScriptCache();
  var raw = cache.get('failed_attempts');
  if (!raw) return false;
  try {
    var data = JSON.parse(raw);
    return data.count >= MAX_FAILED_ATTEMPTS;
  } catch (e) {
    return false;
  }
}

function recordFailedAttempt() {
  var cache = CacheService.getScriptCache();
  var raw = cache.get('failed_attempts');
  var data = { count: 0 };
  if (raw) {
    try { data = JSON.parse(raw); } catch (e) {}
  }
  data.count++;
  cache.put('failed_attempts', JSON.stringify(data), 60);
}

// ---- Router ----

function handleRequest(payload) {
  var action = payload.action;
  var password = payload.password;

  if (isRateLimited()) {
    return { ok: false, error: 'Too many attempts. Try again in a minute.' };
  }

  var correctPassword = getPassword();

  if (action === 'auth') {
    if (password === correctPassword) {
      return { ok: true };
    }
    recordFailedAttempt();
    return { ok: false };
  }

  if (password !== correctPassword) {
    recordFailedAttempt();
    return { ok: false, error: 'Invalid password' };
  }

  switch (action) {
    case 'getAll':
      return getAll();
    case 'addPub':
      return addPub(payload);
    case 'updatePub':
      return updatePub(payload);
    case 'deletePub':
      return deletePub(payload);
    case 'addCategory':
      return addCategory(payload);
    case 'updateCategory':
      return updateCategory(payload);
    case 'deleteCategory':
      return deleteCategory(payload);
    case 'searchPlaces':
      return searchPlaces(payload);
    case 'scrapeMapLink':
      return scrapeMapLink(payload);
    case 'bulkTag':
      return bulkTag(payload);
    case 'logEvent':
      return logEvent(payload);
    default:
      return { ok: false, error: 'Unknown action: ' + action };
  }
}

// ---- Bootstrap ----

function ensureSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var pubsSheet = ss.getSheetByName(PUBS_SHEET);
  if (!pubsSheet) {
    pubsSheet = ss.insertSheet(PUBS_SHEET);
    pubsSheet.getRange(1, 1, 1, PUB_HEADERS.length).setValues([PUB_HEADERS]);
  } else if (pubsSheet.getLastRow() === 0) {
    pubsSheet.getRange(1, 1, 1, PUB_HEADERS.length).setValues([PUB_HEADERS]);
  }

  var catSheet = ss.getSheetByName(CATEGORIES_SHEET);
  if (!catSheet) {
    catSheet = ss.insertSheet(CATEGORIES_SHEET);
    catSheet.getRange(1, 1, 1, CATEGORY_HEADERS.length).setValues([CATEGORY_HEADERS]);
    if (DEFAULT_CATEGORIES.length) {
      catSheet.getRange(2, 1, DEFAULT_CATEGORIES.length, 2).setValues(DEFAULT_CATEGORIES);
    }
  } else if (catSheet.getLastRow() === 0) {
    catSheet.getRange(1, 1, 1, CATEGORY_HEADERS.length).setValues([CATEGORY_HEADERS]);
  }

  var historySheet = ss.getSheetByName(HISTORY_SHEET);
  if (!historySheet) {
    historySheet = ss.insertSheet(HISTORY_SHEET);
    historySheet.getRange(1, 1, 1, HISTORY_HEADERS.length).setValues([HISTORY_HEADERS]);
  } else if (historySheet.getLastRow() === 0) {
    historySheet.getRange(1, 1, 1, HISTORY_HEADERS.length).setValues([HISTORY_HEADERS]);
  }
}

// ---- Read All ----

function getAll() {
  ensureSheets();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Pubs
  var pubsSheet = ss.getSheetByName(PUBS_SHEET);
  var pubsData = pubsSheet.getLastRow() > 1
    ? pubsSheet.getRange(2, 1, pubsSheet.getLastRow() - 1, PUB_HEADERS.length).getValues()
    : [];

  var pubs = pubsData.map(function(row, i) {
    return {
      rowIndex: i + 2,
      name: row[0] || '',
      area: row[1] || '',
      mapsLink: row[2] || '',
      mapsRating: row[3] !== '' && row[3] != null ? Number(row[3]) : null,
      tags: splitList(row[4]),
      food: row[5] || '',
      openingHours: row[6] || '',
      notes: row[7] || '',
      extraInfo: row[8] || '',
      addedBy: row[9] || '',
      lastUpdated: formatDateValue(row[10]),
    };
  });

  // Categories
  var catSheet = ss.getSheetByName(CATEGORIES_SHEET);
  var catData = catSheet.getLastRow() > 1
    ? catSheet.getRange(2, 1, catSheet.getLastRow() - 1, 2).getValues()
    : [];
  var categories = catData.map(function(row, i) {
    return { rowIndex: i + 2, name: row[0] || '', color: row[1] || '#4ecdc4' };
  });

  // History
  var historySheet = ss.getSheetByName(HISTORY_SHEET);
  var historyData = historySheet.getLastRow() > 1
    ? historySheet.getRange(2, 1, historySheet.getLastRow() - 1, HISTORY_HEADERS.length).getValues()
    : [];

  var history = historyData.map(function(row) {
    return {
      timestamp: row[0] || '',
      user: row[1] || '',
      action: row[2] || '',
      pub: row[3] || '',
      summary: row[4] || '',
    };
  }).reverse();

  return { ok: true, pubs: pubs, categories: categories, history: history };
}

// ---- Pub CRUD ----

function addPub(payload) {
  ensureSheets();
  var pub = payload.pub;
  var user = payload.user || 'unknown';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PUBS_SHEET);

  sheet.appendRow([
    pub.name,
    pub.area || '',
    pub.mapsLink || '',
    pub.mapsRating != null && pub.mapsRating !== '' ? Number(pub.mapsRating) : '',
    (pub.tags || []).join(', '),
    pub.food || '',
    pub.openingHours || '',
    pub.notes || '',
    pub.extraInfo || '',
    user,
    new Date().toISOString().slice(0, 10),
  ]);

  logHistory(user, 'Added', pub.name, pub.area ? pub.area : '');
  return { ok: true };
}

function updatePub(payload) {
  ensureSheets();
  var pub = payload.pub;
  var summary = payload.summary || 'Updated';
  var user = payload.user || 'unknown';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PUBS_SHEET);

  var row = [
    pub.name,
    pub.area || '',
    pub.mapsLink || '',
    pub.mapsRating != null && pub.mapsRating !== '' ? Number(pub.mapsRating) : '',
    (pub.tags || []).join(', '),
    pub.food || '',
    pub.openingHours || '',
    pub.notes || '',
    pub.extraInfo || '',
    pub.addedBy || user,
    new Date().toISOString().slice(0, 10),
  ];

  sheet.getRange(pub.rowIndex, 1, 1, row.length).setValues([row]);

  logHistory(user, 'Edited', pub.name, summary);
  return { ok: true };
}

function deletePub(payload) {
  ensureSheets();
  var user = payload.user || 'unknown';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PUBS_SHEET);

  sheet.deleteRow(payload.rowIndex);

  logHistory(user, 'Deleted', payload.name, payload.summary || '');
  return { ok: true };
}

// ---- Category CRUD ----

function addCategory(payload) {
  ensureSheets();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CATEGORIES_SHEET);
  sheet.appendRow([payload.name, payload.color || '#4ecdc4']);
  return { ok: true };
}

function updateCategory(payload) {
  ensureSheets();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CATEGORIES_SHEET);
  sheet.getRange(payload.rowIndex, 1, 1, 2).setValues([[payload.name, payload.color]]);

  // If name changed, update all pubs that use the old name
  if (payload.oldName && payload.oldName !== payload.name) {
    var pubsSheet = ss.getSheetByName(PUBS_SHEET);
    if (pubsSheet.getLastRow() > 1) {
      var tagsCol = 5; // Tags column
      var numRows = pubsSheet.getLastRow() - 1;
      var range = pubsSheet.getRange(2, tagsCol, numRows, 1);
      var values = range.getValues();
      for (var i = 0; i < values.length; i++) {
        var tags = splitList(values[i][0]);
        var idx = tags.indexOf(payload.oldName);
        if (idx !== -1) {
          tags[idx] = payload.name;
          values[i][0] = tags.join(', ');
        }
      }
      range.setValues(values);
    }
  }
  return { ok: true };
}

function deleteCategory(payload) {
  ensureSheets();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CATEGORIES_SHEET);
  sheet.deleteRow(payload.rowIndex);

  // Remove this category from all pubs
  var pubsSheet = ss.getSheetByName(PUBS_SHEET);
  if (pubsSheet.getLastRow() > 1) {
    var tagsCol = 5;
    var numRows = pubsSheet.getLastRow() - 1;
    var range = pubsSheet.getRange(2, tagsCol, numRows, 1);
    var values = range.getValues();
    for (var i = 0; i < values.length; i++) {
      var tags = splitList(values[i][0]);
      var filtered = tags.filter(function(t) { return t !== payload.name; });
      values[i][0] = filtered.join(', ');
    }
    range.setValues(values);
  }
  return { ok: true };
}

// ---- Bulk Tag ----

function bulkTag(payload) {
  ensureSheets();
  var tag = payload.tag;
  var names = payload.names || [];
  if (!tag || !names.length) return { ok: false, error: 'Missing tag or names' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PUBS_SHEET);
  if (sheet.getLastRow() <= 1) return { ok: true, updated: 0 };

  var numRows = sheet.getLastRow() - 1;
  var nameRange = sheet.getRange(2, 1, numRows, 1).getValues();
  var tagsRange = sheet.getRange(2, 5, numRows, 1);
  var tagsValues = tagsRange.getValues();

  var lowerNames = names.map(function(n) { return String(n).trim().toLowerCase(); });
  var updated = 0;

  for (var i = 0; i < numRows; i++) {
    var pubName = String(nameRange[i][0]).trim().toLowerCase();
    var matched = lowerNames.some(function(n) {
      return pubName.indexOf(n) !== -1 || n.indexOf(pubName) !== -1;
    });
    if (!matched) continue;

    var tags = splitList(tagsValues[i][0]);
    if (tags.indexOf(tag) !== -1) continue;

    tags.push(tag);
    tagsValues[i][0] = tags.join(', ');
    updated++;
  }

  if (updated > 0) {
    tagsRange.setValues(tagsValues);
    logHistory(payload.user || 'unknown', 'Bulk tagged', tag, updated + ' pubs');
  }

  return { ok: true, updated: updated };
}

// ---- Events ----

function logEvent(payload) {
  ensureSheets();
  logHistory(payload.user || 'unknown', payload.eventType || 'Event', '', payload.summary || '');
  return { ok: true };
}

// ---- Google Places API ----

function searchPlaces(payload) {
  var query = payload.query;
  if (!query || query.length < 2) return { ok: true, results: [] };

  try {
    var fields = 'places.displayName,places.formattedAddress,places.rating,places.googleMapsUri,places.location';
    var body = {
      textQuery: query,
      maxResultCount: 5,
      includedType: 'bar',
    };
    // Bias toward user's location if provided, otherwise Brighton
    var lat = payload.lat || 50.8225;
    var lng = payload.lng || -0.1372;
    body.locationBias = {
      circle: { center: { latitude: lat, longitude: lng }, radius: 20000 }
    };

    var apiResponse = UrlFetchApp.fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': getPlacesApiKey(),
        'X-Goog-FieldMask': fields,
      },
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    });

    var data = JSON.parse(apiResponse.getContentText());
    if (!data.places) return { ok: true, results: [] };

    var results = data.places.map(function(p) {
      return {
        name: p.displayName ? p.displayName.text : '',
        address: p.formattedAddress || '',
        rating: p.rating || null,
        mapsUri: p.googleMapsUri || '',
        lat: p.location ? p.location.latitude : null,
        lng: p.location ? p.location.longitude : null,
      };
    });

    return { ok: true, results: results };
  } catch (e) {
    return { ok: false, error: 'Search error: ' + e.message, results: [] };
  }
}

function scrapeMapLink(payload) {
  var url = payload.url;
  var query = payload.placeName || null;
  var latLng = null;

  if (payload.placeLat != null && payload.placeLng != null) {
    latLng = { lat: payload.placeLat, lng: payload.placeLng };
  }

  // Follow redirect chain for shortened URLs (maps.app.goo.gl, goo.gl, etc.)
  if (url && /goo\.gl|maps\.app/i.test(url)) {
    for (var i = 0; i < 5; i++) {
      try {
        var resp = UrlFetchApp.fetch(url, { followRedirects: false, muteHttpExceptions: true });
        var code = resp.getResponseCode();
        if (code < 300 || code >= 400) break;
        var headers = resp.getHeaders();
        var location = headers['Location'] || headers['location'];
        if (!location) break;
        url = location;
      } catch (e) { break; }
    }
  }

  if (!query && url) {
    // Extract place name from URL path: /maps/place/Place+Name/
    var placeMatch = url.match(/\/maps\/place\/([^/@]+)/);
    if (placeMatch) {
      query = decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')).trim();
    }
  }

  if (!query) return { ok: false, error: 'Could not determine place name' };

  try {
    // Extract coordinates from URL if not already provided
    if (!latLng && url) {
      var coordMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (coordMatch) {
        latLng = { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
      }
    }

    // Call Places API (New) - Text Search
    var fields = [
      'places.displayName', 'places.rating', 'places.userRatingCount', 'places.location',
      'places.regularOpeningHours', 'places.formattedAddress', 'places.websiteUri',
      'places.nationalPhoneNumber', 'places.priceLevel',
      'places.outdoorSeating', 'places.liveMusic', 'places.servesBeer',
      'places.servesWine', 'places.servesCocktails', 'places.servesBreakfast',
      'places.servesLunch', 'places.servesDinner', 'places.servesBrunch',
      'places.servesVegetarianFood', 'places.goodForGroups',
      'places.goodForChildren', 'places.allowsDogs', 'places.restroom',
      'places.accessibilityOptions', 'places.paymentOptions',
      'places.dineIn', 'places.takeout', 'places.delivery',
      'places.reservable', 'places.currentOpeningHours',
      'places.addressComponents', 'places.primaryTypeDisplayName',
    ].join(',');
    var body = {
      textQuery: latLng ? query : query + ' Brighton',
      maxResultCount: 1,
    };
    if (latLng) {
      body.locationBias = {
        circle: { center: { latitude: latLng.lat, longitude: latLng.lng }, radius: 500 }
      };
    }

    var apiResponse = UrlFetchApp.fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': getPlacesApiKey(),
        'X-Goog-FieldMask': fields,
      },
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    });

    var data = JSON.parse(apiResponse.getContentText());
    if (!data.places || !data.places.length) {
      return { ok: false, error: 'Place not found' };
    }

    var place = data.places[0];

    // Format opening hours
    var hours = '';
    if (place.regularOpeningHours && place.regularOpeningHours.weekdayDescriptions) {
      hours = place.regularOpeningHours.weekdayDescriptions.join(', ');
    }

    // Collect boolean features for auto-tagging
    var features = {};
    if (place.outdoorSeating === true) features.outdoorSeating = true;
    if (place.liveMusic === true) features.liveMusic = true;
    if (place.servesBeer === true) features.servesBeer = true;
    if (place.allowsDogs === true) features.allowsDogs = true;
    if (place.servesCocktails === true) features.servesCocktails = true;
    if (place.goodForChildren === true) features.goodForChildren = true;
    if (place.reservable === true) features.reservable = true;
    if (place.servesVegetarianFood === true) features.servesVegetarianFood = true;

    // Build extra info from all non-empty values
    var extra = {};
    if (place.formattedAddress) extra['Address'] = place.formattedAddress;
    if (place.nationalPhoneNumber) extra['Phone'] = place.nationalPhoneNumber;
    if (place.websiteUri) extra['Website'] = place.websiteUri;
    if (place.userRatingCount) extra['Reviews'] = place.userRatingCount + ' reviews';
    if (place.priceLevel) extra['Price level'] = place.priceLevel.replace('PRICE_LEVEL_', '');
    if (place.outdoorSeating === true) extra['Outdoor seating'] = 'Yes';
    if (place.liveMusic === true) extra['Live music'] = 'Yes';
    if (place.servesBeer === true) extra['Serves beer'] = 'Yes';
    if (place.servesWine === true) extra['Serves wine'] = 'Yes';
    if (place.servesCocktails === true) extra['Serves cocktails'] = 'Yes';
    if (place.servesBreakfast === true) extra['Breakfast'] = 'Yes';
    if (place.servesBrunch === true) extra['Brunch'] = 'Yes';
    if (place.servesLunch === true) extra['Lunch'] = 'Yes';
    if (place.servesDinner === true) extra['Dinner'] = 'Yes';
    if (place.servesVegetarianFood === true) extra['Vegetarian food'] = 'Yes';
    if (place.goodForGroups === true) extra['Good for groups'] = 'Yes';
    if (place.goodForChildren === true) extra['Good for children'] = 'Yes';
    if (place.allowsDogs === true) extra['Dogs allowed'] = 'Yes';
    if (place.restroom === true) extra['Restroom'] = 'Yes';
    if (place.dineIn === true) extra['Dine-in'] = 'Yes';
    if (place.takeout === true) extra['Takeout'] = 'Yes';
    if (place.delivery === true) extra['Delivery'] = 'Yes';
    if (place.reservable === true) extra['Reservable'] = 'Yes';
    if (place.accessibilityOptions) {
      var a11y = [];
      if (place.accessibilityOptions.wheelchairAccessibleEntrance) a11y.push('Entrance');
      if (place.accessibilityOptions.wheelchairAccessibleRestroom) a11y.push('Restroom');
      if (place.accessibilityOptions.wheelchairAccessibleSeating) a11y.push('Seating');
      if (a11y.length) extra['Wheelchair accessible'] = a11y.join(', ');
    }
    if (place.paymentOptions) {
      var pay = [];
      if (place.paymentOptions.acceptsCreditCards) pay.push('Cards');
      if (place.paymentOptions.acceptsCashOnly) pay.push('Cash only');
      if (place.paymentOptions.acceptsNfc) pay.push('Contactless');
      if (pay.length) extra['Payment'] = pay.join(', ');
    }

    // Include lat/lng from Places API
    var lat = null, lng = null;
    if (place.location) {
      lat = place.location.latitude;
      lng = place.location.longitude;
    }

    // Extract area from address components
    var area = '';
    if (place.addressComponents) {
      var comps = place.addressComponents;
      // Prefer neighborhood, then sublocality, then locality
      for (var ci = 0; ci < comps.length; ci++) {
        var types = comps[ci].types || [];
        if (types.indexOf('neighborhood') !== -1) { area = comps[ci].longText || comps[ci].shortText || ''; break; }
      }
      if (!area) {
        for (var ci = 0; ci < comps.length; ci++) {
          var types = comps[ci].types || [];
          if (types.indexOf('sublocality') !== -1 || types.indexOf('sublocality_level_1') !== -1) { area = comps[ci].longText || comps[ci].shortText || ''; break; }
        }
      }
      if (!area) {
        for (var ci = 0; ci < comps.length; ci++) {
          var types = comps[ci].types || [];
          if (types.indexOf('postal_town') !== -1) { area = comps[ci].longText || comps[ci].shortText || ''; break; }
        }
      }
    }

    // Extract food/cuisine from place type
    var food = '';
    if (place.primaryTypeDisplayName) {
      var typeName = place.primaryTypeDisplayName.text || '';
      // Extract cuisine from type names like "Pizza restaurant", "Thai restaurant"
      var cuisineMatch = typeName.match(/^(.+?)\s*restaurant$/i);
      if (cuisineMatch) {
        food = cuisineMatch[1];
      } else if (/gastropub/i.test(typeName)) {
        food = 'Full menu';
      }
    }
    // Build food hints from serves* flags
    var foodTypes = [];
    if (place.servesBreakfast === true) foodTypes.push('Breakfast');
    if (place.servesBrunch === true) foodTypes.push('Brunch');
    if (place.servesLunch === true) foodTypes.push('Lunch');
    if (place.servesDinner === true) foodTypes.push('Dinner');
    var foodHints = foodTypes.length ? foodTypes.join(', ') : '';

    return {
      ok: true,
      name: place.displayName ? place.displayName.text : '',
      rating: place.rating || null,
      area: area,
      food: food,
      foodHints: foodHints,
      openingHours: hours,
      features: features,
      extraInfo: JSON.stringify(extra),
      lat: lat,
      lng: lng,
    };
  } catch (e) {
    return { ok: false, error: 'Places API error: ' + e.message };
  }
}

// ---- History ----

function logHistory(user, action, pub, summary) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(HISTORY_SHEET);
  sheet.appendRow([new Date().toISOString(), user, action, pub, summary]);
}

// ---- Helpers ----

function splitList(val) {
  if (!val) return [];
  return String(val).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
}

function formatDateValue(val) {
  if (!val) return '';
  if (val instanceof Date) {
    var y = val.getFullYear();
    var m = ('0' + (val.getMonth() + 1)).slice(-2);
    var d = ('0' + val.getDate()).slice(-2);
    return y + '-' + m + '-' + d;
  }
  return String(val);
}
