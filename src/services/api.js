const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;

// ---- Session persistence ----

const SESSION_KEY = 'brighton-pubs-session';

export function getSavedSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

export function saveSession(name, password) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ name, password }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ---- API call ----

async function apiCall(payload) {
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid response from server');
  }
  if (data.error) throw new Error(data.error);
  return data;
}

// ---- Auth ----

export async function checkPassword(password) {
  const data = await apiCall({ action: 'auth', password });
  return data.ok;
}

// ---- Data ----

export async function fetchAll(password, city) {
  return apiCall({ action: 'getAll', password, city });
}

function cacheKey(city) { return `pubs-cache-${city || 'brighton'}`; }
function historyCacheKey() { return 'pubs-history-cache'; }

export function getCachedData(city) {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(city)));
  } catch {
    return null;
  }
}

function setCachedData(city, pubs, categories, history) {
  try {
    localStorage.setItem(cacheKey(city), JSON.stringify({ pubs, categories }));
  } catch {}
  if (history) {
    try {
      localStorage.setItem(historyCacheKey(), JSON.stringify(history));
    } catch {}
  }
}

export function getCachedHistory() {
  try {
    return JSON.parse(localStorage.getItem(historyCacheKey()));
  } catch {
    return null;
  }
}

export async function fetchPubsAndCategories(password, city) {
  try {
    const data = await apiCall({ action: 'getPubsAndCategories', password, city });
    setCachedData(city, data.pubs, data.categories);
    return data;
  } catch (e) {
    // Fall back to fetchAll if new endpoint not deployed yet
    if (e.message?.includes('Unknown action')) {
      const data = await fetchAll(password, city);
      // Old backend only has Brighton data — don't use it for other cities
      if (city && city !== 'brighton') {
        return { ok: true, pubs: [], categories: [] };
      }
      setCachedData(city, data.pubs, data.categories, data.history);
      return data;
    }
    throw e;
  }
}

export async function fetchHistory(password, city) {
  let result;
  try {
    result = await apiCall({ action: 'getHistory', password, city });
  } catch (e) {
    if (e.message?.includes('Unknown action')) {
      if (city && city !== 'brighton') {
        return { ok: true, history: [] };
      }
      const data = await fetchAll(password, city);
      result = { ok: true, history: data.history };
    } else {
      throw e;
    }
  }
  try { localStorage.setItem(historyCacheKey(), JSON.stringify(result.history)); } catch {}
  return result;
}

export async function addPub(password, user, pub, city) {
  return apiCall({ action: 'addPub', password, user, pub, city });
}

export async function updatePub(password, user, pub, summary, city) {
  return apiCall({ action: 'updatePub', password, user, pub, summary, city });
}

export async function removePub(password, user, pub, city) {
  return apiCall({
    action: 'deletePub', password, user, city,
    rowIndex: pub.rowIndex,
    name: pub.name,
    summary: pub.area || '',
  });
}

// ---- Categories ----

export async function addCategory(password, name, color, city) {
  return apiCall({ action: 'addCategory', password, name, color, city });
}

export async function updateCategory(password, rowIndex, name, color, oldName, city) {
  return apiCall({ action: 'updateCategory', password, rowIndex, name, color, oldName, city });
}

export async function deleteCategory(password, rowIndex, name, city) {
  return apiCall({ action: 'deleteCategory', password, rowIndex, name, city });
}

// ---- Events ----

export function logEvent(password, user, eventType, summary, city) {
  apiCall({ action: 'logEvent', password, user, eventType, summary, city }).catch(() => {});
}

export function logVisitIfStale(password, name, city) {
  const key = `pubs-last-visit-${city || 'brighton'}`;
  const last = localStorage.getItem(key);
  const now = Date.now();
  if (!last || now - Number(last) > 3600000) {
    localStorage.setItem(key, String(now));
    logEvent(password, name, 'Visited', '', city);
  }
}

// ---- Refetch All ----

export async function refetchAll(password, user, city) {
  return apiCall({ action: 'refetchAll', password, user, city });
}

// ---- Bulk Tag ----

export async function bulkTag(password, user, tag, names, city) {
  return apiCall({ action: 'bulkTag', password, user, tag, names, city });
}

// ---- Places Search ----

export async function searchPlaces(password, query, lat, lng, city) {
  return apiCall({ action: 'searchPlaces', password, query, lat, lng, city });
}

// ---- Scrape ----

export async function scrapeMapLink(password, url, placeName, placeLat, placeLng, city) {
  return apiCall({ action: 'scrapeMapLink', password, url, placeName, placeLat, placeLng, city });
}

// ---- Diff ----

export function buildDiffSummary(oldPub, newPub) {
  const changes = [];
  const fields = { name: 'Name', area: 'Area', mapsLink: 'Maps Link', mapsRating: 'Rating', food: 'Food', openingHours: 'Hours', notes: 'Notes' };
  for (const [key, label] of Object.entries(fields)) {
    if (String(oldPub[key] ?? '') !== String(newPub[key] ?? '')) {
      changes.push(label);
    }
  }
  const oldTags = (oldPub.tags || []).sort().join(',');
  const newTags = (newPub.tags || []).sort().join(',');
  if (oldTags !== newTags) changes.push('Tags');
  return changes.length ? changes.join(', ') : 'Updated';
}
