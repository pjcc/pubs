import { useState, useRef, useEffect } from 'react';
import { searchPlaces, scrapeMapLink } from '../services/api.js';

export default function BulkAddForm({ password, onAdd, onDone, onCancel }) {
  const [text, setText] = useState('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const cancelRef = useRef(false);
  const userLocation = useRef(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { userLocation.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
        () => {},
        { timeout: 5000 }
      );
    }
  }, []);

  async function handleRun() {
    const names = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!names.length) return;

    setRunning(true);
    cancelRef.current = false;
    setResults(names.map((n) => ({ name: n, status: 'pending' })));

    for (let i = 0; i < names.length; i++) {
      if (cancelRef.current) break;
      const name = names[i];
      setResults((r) => r.map((x, j) => j === i ? { ...x, status: 'searching' } : x));

      try {
        const loc = userLocation.current;
        const search = await searchPlaces(password, name, loc?.lat, loc?.lng);
        if (!search.ok || !search.results?.length) {
          setResults((r) => r.map((x, j) => j === i ? { ...x, status: 'not_found' } : x));
          continue;
        }

        const place = search.results[0];
        setResults((r) => r.map((x, j) => j === i ? { ...x, status: 'fetching', matched: place.name } : x));

        const detail = await scrapeMapLink(password, place.mapsUri, place.name, place.lat, place.lng);

        // Start with search data as baseline
        const baseExtra = {};
        if (place.lat != null) baseExtra._lat = place.lat;
        if (place.lng != null) baseExtra._lng = place.lng;

        const pub = {
          name: place.name,
          area: '',
          mapsLink: place.mapsUri || '',
          mapsRating: place.rating,
          tags: [],
          food: '',
          openingHours: '',
          notes: '',
          extraInfo: JSON.stringify(baseExtra),
        };

        // Overlay full detail if available
        if (detail.ok) {
          if (detail.rating != null) pub.mapsRating = detail.rating;
          if (detail.area) pub.area = detail.area;
          if (detail.openingHours) pub.openingHours = detail.openingHours;
          if (detail.extraInfo) {
            try {
              const info = JSON.parse(detail.extraInfo);
              if (place.lat != null) info._lat = place.lat;
              if (place.lng != null) info._lng = place.lng;
              pub.extraInfo = JSON.stringify(info);
            } catch {
              pub.extraInfo = detail.extraInfo;
            }
          }
          if (detail.features) {
            const autoTags = [];
            const featureMap = {
              outdoorSeating: ['Garden', 'Terrace', 'Covered Outdoor'],
              liveMusic: ['Live Music'],
              allowsDogs: ['Dog Friendly'],
              servesCocktails: ['Cocktails'],
              goodForChildren: ['Family Friendly'],
              reservable: ['Reservable'],
              servesVegetarianFood: ['Vegetarian Options'],
            };
            for (const [feat, names] of Object.entries(featureMap)) {
              if (detail.features[feat]) {
                for (const n of names) autoTags.push(n);
              }
            }
            if (autoTags.length) pub.tags = autoTags;
          }
        }

        const result = await onAdd(pub, { silent: true });
        if (result === 'duplicate') {
          setResults((r) => r.map((x, j) => j === i ? { ...x, status: 'duplicate', matched: place.name } : x));
          continue;
        }
        const warn = !detail.ok ? detail.error || 'Details fetch failed' : null;
        setResults((r) => r.map((x, j) => j === i ? { ...x, status: 'added', matched: place.name, warn } : x));
      } catch (e) {
        setResults((r) => r.map((x, j) => j === i ? { ...x, status: 'error', error: e.message } : x));
      }
    }

    setRunning(false);
    if (onDone) onDone();
  }

  function handleCancel() {
    if (running) {
      cancelRef.current = true;
    } else {
      onCancel();
    }
  }

  const names = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const allDone = results.length > 0 && results.every((r) => r.status !== 'pending' && r.status !== 'searching' && r.status !== 'fetching');

  return (
    <div className="bulk-add-form">
      <div className="form-body">
        {!running && results.length === 0 && (
          <>
            <p className="bulk-hint">Enter one pub name per line. Each will be searched on Google Maps and added automatically.</p>
            <textarea
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"The Basketmakers Arms\nThe Lord Nelson Inn\nThe Pond\n..."}
              autoFocus
            />
          </>
        )}
        {results.length > 0 && (
          <div className="bulk-results">
            {results.map((r, i) => (
              <div key={i} className={`bulk-result-row bulk-${r.status}`}>
                <span className="bulk-status-icon">
                  {r.status === 'pending' && '...'}
                  {r.status === 'searching' && '...'}
                  {r.status === 'fetching' && '...'}
                  {r.status === 'added' && '\u2713'}
                  {r.status === 'duplicate' && '\u2013'}
                  {r.status === 'not_found' && '\u2717'}
                  {r.status === 'error' && '\u2717'}
                </span>
                <span className="bulk-name">{r.name}</span>
                {r.matched && r.matched !== r.name && (
                  <span className="bulk-matched">{r.matched}</span>
                )}
                {r.status === 'searching' && <span className="bulk-info">Searching...</span>}
                {r.status === 'fetching' && <span className="bulk-info">Fetching details...</span>}
                {r.status === 'duplicate' && <span className="bulk-info">Already exists</span>}
                {r.status === 'not_found' && <span className="bulk-info">Not found</span>}
                {r.status === 'error' && <span className="bulk-info">{r.error}</span>}
                {r.status === 'added' && r.warn && <span className="bulk-info bulk-warn">(partial: {r.warn})</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={handleCancel}>
          {running ? 'Stop' : allDone ? 'Close' : 'Cancel'}
        </button>
        {!running && !allDone && (
          <button type="button" className="btn btn-primary" disabled={!names.length} onClick={handleRun}>
            Add {names.length} pub{names.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  );
}
