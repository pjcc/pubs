import { useState, useRef, useEffect, useCallback } from 'react';
import { scrapeMapLink, searchPlaces } from '../services/api.js';
import { getTagIcon } from '../tagIcons.js';

const FOOD_OPTIONS = ['', 'Full menu', 'Bar snacks', 'Sunday roasts', 'Pizza', 'No food'];

export default function PubForm({ pub, onSubmit, onCancel, password, city, categories, showIcons, existingPubs }) {
  const isEdit = !!pub;
  const [form, setForm] = useState(() => ({
    name: String(pub?.name || ''),
    area: String(pub?.area || ''),
    mapsLink: String(pub?.mapsLink || ''),
    mapsRating: pub?.mapsRating != null ? String(pub.mapsRating) : '',
    tags: pub?.tags || [],
    food: pub?.food || '',
    openingHours: pub?.openingHours || '',
    notes: pub?.notes || '',
    extraInfo: pub?.extraInfo || '',
  }));
  const [submitting, setSubmitting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimer = useRef(null);
  const suggestionsRef = useRef(null);
  const userLocation = useRef(null);

  useEffect(() => {
    if (!isEdit && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { userLocation.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
        () => {},
        { timeout: 5000 }
      );
    }
  }, []);

  const doSearch = useCallback(async (query) => {
    if (query.length < 2) { setSuggestions([]); return; }
    setSearching(true);
    try {
      const loc = userLocation.current;
      const res = await searchPlaces(password, query, loc?.lat, loc?.lng, city);
      if (res.ok && res.results) {
        setSuggestions(res.results);
        setShowSuggestions(true);
      }
    } catch {}
    setSearching(false);
  }, [password]);

  function handleNameChange(val) {
    setForm((f) => ({ ...f, name: val }));
    clearTimeout(searchTimer.current);
    if (!isEdit && val.trim().length >= 2) {
      searchTimer.current = setTimeout(() => doSearch(val.trim()), 400);
    } else {
      setSuggestions([]);
    }
  }

  async function handleSelectSuggestion(s) {
    setShowSuggestions(false);
    setSuggestions([]);
    setForm((f) => ({ ...f, name: s.name, mapsLink: s.mapsUri }));
    if (s.name) {
      setFetching(true);
      setFetchError(null);
      try {
        const data = await scrapeMapLink(password, s.mapsUri, s.name, s.lat, s.lng, city);
        if (data.ok) {
          setForm((f) => {
            const updated = { ...f, name: s.name, mapsLink: s.mapsUri };
            if (data.rating != null) updated.mapsRating = String(data.rating);
            if (data.area && !f.area.trim()) updated.area = data.area;
            if (!f.food.trim() && (data.food || data.foodHints)) updated.food = data.food || data.foodHints;
            if (data.openingHours && !f.openingHours.trim()) updated.openingHours = data.openingHours;
            if (data.extraInfo) {
              try {
                const info = JSON.parse(data.extraInfo);
                if (s.lat != null) info._lat = s.lat;
                if (s.lng != null) info._lng = s.lng;
                updated.extraInfo = JSON.stringify(info);
              } catch {
                updated.extraInfo = data.extraInfo;
              }
            }
            if (data.features) {
              const autoTags = [...f.tags];
              const featureMap = {
                outdoorSeating: ['garden', 'terrace', 'covered outdoor'],
                liveMusic: ['live music'],
                allowsDogs: ['dog friendly'],
                servesCocktails: ['cocktails'],
                goodForChildren: ['family friendly'],
                reservable: ['reservable'],
                servesVegetarianFood: ['vegetarian options'],
              };
              for (const [feat, keywords] of Object.entries(featureMap)) {
                if (data.features[feat]) {
                  for (const kw of keywords) {
                    const match = categories.find((c) => String(c.name).toLowerCase() === kw);
                    if (match && !autoTags.includes(match.name)) autoTags.push(match.name);
                  }
                }
              }
              updated.tags = autoTags;
            }
            return updated;
          });
        } else {
          setFetchError(data.error || 'Could not fetch details');
        }
      } catch (e) {
        setFetchError(e.message || 'Failed to fetch');
      }
      setFetching(false);
    }
  }

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function toggleTag(tagName) {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tagName)
        ? f.tags.filter((t) => t !== tagName)
        : [...f.tags, tagName],
    }));
  }

  async function handleFetchFromMaps() {
    if (!form.mapsLink.trim()) return;
    setFetching(true);
    setFetchError(null);
    try {
      const data = await scrapeMapLink(password, form.mapsLink.trim(), form.name.trim() || undefined, undefined, undefined, city);
      if (data.ok) {
        setForm((f) => {
          const updated = { ...f };
          if (!f.name.trim() && data.name) updated.name = data.name;
          if (data.rating != null) updated.mapsRating = String(data.rating);
          if (data.area && !f.area.trim()) updated.area = data.area;
          if (!f.food.trim() && (data.food || data.foodHints)) updated.food = data.food || data.foodHints;
          if (data.openingHours && !f.openingHours.trim()) updated.openingHours = data.openingHours;
          if (data.extraInfo) {
            // Inject lat/lng into extraInfo for map view
            try {
              const info = JSON.parse(data.extraInfo);
              if (data.lat != null) info._lat = data.lat;
              if (data.lng != null) info._lng = data.lng;
              updated.extraInfo = JSON.stringify(info);
            } catch {
              updated.extraInfo = data.extraInfo;
            }
          }

          // Auto-tag based on Places API features
          if (data.features) {
            const autoTags = [...f.tags];
            const featureMap = {
              outdoorSeating: ['garden', 'terrace', 'covered outdoor'],
              liveMusic: ['live music'],
              allowsDogs: ['dog friendly'],
              servesCocktails: ['cocktails'],
              goodForChildren: ['family friendly'],
              reservable: ['reservable'],
              servesVegetarianFood: ['vegetarian options'],
            };
            for (const [feat, keywords] of Object.entries(featureMap)) {
              if (data.features[feat]) {
                for (const kw of keywords) {
                  const match = categories.find((c) => String(c.name).toLowerCase() === kw);
                  if (match && !autoTags.includes(match.name)) {
                    autoTags.push(match.name);
                  }
                }
              }
            }
            updated.tags = autoTags;
          }
          return updated;
        });
      } else {
        setFetchError(data.error || 'Could not fetch details');
      }
    } catch (e) {
      setFetchError(e.message || 'Failed to fetch from Google Maps');
    }
    setFetching(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    const data = {
      ...form,
      name: form.name.trim(),
      mapsRating: form.mapsRating ? parseFloat(form.mapsRating) : null,
    };
    if (isEdit) {
      data.rowIndex = pub.rowIndex;
      data.addedBy = pub.addedBy;
    }
    await onSubmit(data);
    setSubmitting(false);
  }

  const isValid = form.name.trim();
  const dupeMatch = !isEdit && existingPubs && form.name.trim() && existingPubs.find((p) =>
    String(p.name).trim().toLowerCase() === form.name.trim().toLowerCase()
  );

  return (
    <form className="pub-form" onSubmit={handleSubmit}>
      <div className="form-body">
        <label>
          Pub name *
          <div className="name-search-wrap">
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={isEdit ? '' : 'Search for a pub...'}
              autoFocus
              required
              onFocus={() => suggestions.length && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            {searching && <span className="search-spinner" />}
            {showSuggestions && suggestions.length > 0 && (
              <div className="name-suggestions" ref={suggestionsRef}>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="suggestion-item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectSuggestion(s)}
                  >
                    <span className="suggestion-name">{s.name}</span>
                    <span className="suggestion-detail">
                      {s.rating && <span className="suggestion-rating">★ {s.rating}</span>}
                      {s.address}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {fetching && <span className="fetch-status">Fetching details...</span>}
          {fetchError && <span className="fetch-error">{fetchError}</span>}
          {dupeMatch && <span className="fetch-error">"{dupeMatch.name}" already exists</span>}
        </label>

        <label>
          Google Maps Link
          <div className="maps-link-row">
            <div className="maps-link-wrap">
              <input type="url" value={form.mapsLink} onChange={(e) => set('mapsLink', e.target.value)} placeholder="https://maps.google.com/..." />
              {navigator.clipboard && (
                <button
                  type="button"
                  className="paste-btn"
                  title="Paste"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) set('mapsLink', text);
                    } catch {}
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              )}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!form.mapsLink.trim() || fetching}
              onClick={handleFetchFromMaps}
            >
              {fetching ? 'Fetching...' : 'Fetch info'}
            </button>
          </div>
        </label>

        <div className="form-row">
          <label>
            Area
            <input type="text" value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="e.g. North Laine, Kemptown" />
          </label>
          <label>
            Google Maps Rating
            <input type="number" step="0.1" min="0" max="5" value={form.mapsRating} onChange={(e) => set('mapsRating', e.target.value)} placeholder="e.g. 4.3" />
          </label>
        </div>

        {categories.length > 0 && (
          <fieldset className="checkbox-group">
            <legend>Tags</legend>
            {categories.map((cat) => (
              <label key={cat.name} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.tags.includes(cat.name)}
                  onChange={() => toggleTag(cat.name)}
                />
                <span className="cat-dot" style={{ background: cat.color }}></span>
                {showIcons && getTagIcon(cat.name) ? `${getTagIcon(cat.name)} ` : ''}{cat.name}
              </label>
            ))}
          </fieldset>
        )}

        <div className="form-row">
          <label>
            Food
            <div className="food-input">
              <select value={FOOD_OPTIONS.includes(form.food) ? form.food : '__custom'} onChange={(e) => {
                if (e.target.value === '__custom') return;
                set('food', e.target.value);
              }}>
                {FOOD_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt || '-- Select --'}</option>
                ))}
                {!FOOD_OPTIONS.includes(form.food) && form.food && (
                  <option value="__custom">Custom</option>
                )}
              </select>
              <input type="text" value={form.food} onChange={(e) => set('food', e.target.value)} placeholder="Or type custom..." />
            </div>
          </label>
        </div>

        <label>
          Opening Hours
          <input type="text" value={form.openingHours} onChange={(e) => set('openingHours', e.target.value)} placeholder="e.g. Mon-Thu 12-11, Fri-Sat 12-1am, Sun 12-10:30" />
        </label>

        <label>
          Notes
          <textarea rows="3" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything else worth knowing..." />
        </label>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={!isValid || submitting}>
          {submitting ? 'Saving...' : isEdit ? 'Update Pub' : 'Add Pub'}
        </button>
      </div>
    </form>
  );
}
