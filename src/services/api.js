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

export async function fetchAll(password) {
  return apiCall({ action: 'getAll', password });
}

const CACHE_KEY = 'brighton-pubs-cache';

export function getCachedData() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY));
  } catch {
    return null;
  }
}

const HISTORY_CACHE_KEY = 'brighton-pubs-history-cache';

function setCachedData(pubs, categories, history) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ pubs, categories }));
  } catch {}
  if (history) {
    try {
      localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(history));
    } catch {}
  }
}

export function getCachedHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_CACHE_KEY));
  } catch {
    return null;
  }
}

export async function fetchPubsAndCategories(password) {
  try {
    const data = await apiCall({ action: 'getPubsAndCategories', password });
    setCachedData(data.pubs, data.categories);
    return data;
  } catch (e) {
    // Fall back to fetchAll if new endpoint not deployed yet
    if (e.message?.includes('Unknown action')) {
      const data = await fetchAll(password);
      setCachedData(data.pubs, data.categories, data.history);
      return data; // includes .history when falling back
    }
    throw e;
  }
}

export async function fetchHistory(password) {
  let result;
  try {
    result = await apiCall({ action: 'getHistory', password });
  } catch (e) {
    if (e.message?.includes('Unknown action')) {
      const data = await fetchAll(password);
      result = { ok: true, history: data.history };
    } else {
      throw e;
    }
  }
  try { localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(result.history)); } catch {}
  return result;
}

export async function addPub(password, user, pub) {
  return apiCall({ action: 'addPub', password, user, pub });
}

export async function updatePub(password, user, pub, summary) {
  return apiCall({ action: 'updatePub', password, user, pub, summary });
}

export async function removePub(password, user, pub) {
  return apiCall({
    action: 'deletePub',
    password,
    user,
    rowIndex: pub.rowIndex,
    name: pub.name,
    summary: pub.area || '',
  });
}

// ---- Categories ----

export async function addCategory(password, name, color) {
  return apiCall({ action: 'addCategory', password, name, color });
}

export async function updateCategory(password, rowIndex, name, color, oldName) {
  return apiCall({ action: 'updateCategory', password, rowIndex, name, color, oldName });
}

export async function deleteCategory(password, rowIndex, name) {
  return apiCall({ action: 'deleteCategory', password, rowIndex, name });
}

// ---- Events ----

export function logEvent(password, user, eventType, summary) {
  apiCall({ action: 'logEvent', password, user, eventType, summary }).catch(() => {});
}

export function logVisitIfStale(password, name) {
  const key = 'brighton-pubs-last-visit';
  const last = localStorage.getItem(key);
  const now = Date.now();
  if (!last || now - Number(last) > 3600000) {
    localStorage.setItem(key, String(now));
    logEvent(password, name, 'Visited', '');
  }
}

// ---- Refetch All ----

export async function refetchAll(password, user) {
  return apiCall({ action: 'refetchAll', password, user });
}

// ---- Bulk Tag ----

export async function bulkTag(password, user, tag, names) {
  return apiCall({ action: 'bulkTag', password, user, tag, names });
}

// ---- Places Search ----

export async function searchPlaces(password, query, lat, lng) {
  return apiCall({ action: 'searchPlaces', password, query, lat, lng });
}

// ---- Scrape ----

export async function scrapeMapLink(password, url, placeName, placeLat, placeLng) {
  return apiCall({ action: 'scrapeMapLink', password, url, placeName, placeLat, placeLng });
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
