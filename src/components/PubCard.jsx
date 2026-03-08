function ExtraInfo({ raw }) {
  if (!raw) return null;
  let info;
  try { info = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  const entries = Object.entries(info).filter(([k, v]) => v && !k.startsWith('_'));
  if (!entries.length) return null;
  return (
    <div className="extra-info-wrap">
      <span className="extra-info-trigger" tabIndex={0}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        Google info
        <div className="extra-info-tooltip">
          <div className="extra-info-tooltip-inner">
            {entries.map(([k, v]) => (
              <div key={k} className="extra-info-row">
                <span className="extra-info-label">{k}</span>
                {String(v).startsWith('http') ? (
                  <a href={v} target="_blank" rel="noopener noreferrer">{v}</a>
                ) : (
                  <span>{v}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </span>
    </div>
  );
}

function StarRating({ rating }) {
  if (rating == null) return null;
  return <span className="pub-rating" title={`${rating} on Google Maps`}>{'★'} {rating}</span>;
}

function parseHours(raw) {
  const str = Array.isArray(raw) ? raw.join(', ') : String(raw || '');
  if (!str.trim()) return null;
  // Split into day entries: "Monday: 9:00 AM – 10:00 PM, Tuesday: ..."
  const days = str.split(/,\s*(?=\w+day:)/i);
  if (days.length <= 1) return { summary: str.trim(), lines: null };
  // Build tooltip lines and a short summary
  const lines = days.map((d) => d.trim());
  // Try to find today's hours for the summary
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = dayNames[new Date().getDay()];
  const todayLine = lines.find((l) => l.startsWith(today));
  const summary = todayLine ? todayLine.replace(today + ': ', '') : lines[0];
  return { summary, lines, today };
}

import { getTagIcon } from '../tagIcons.js';

export default function PubCard({ pub, onEdit, onDelete, changeType, categories, isFavourite, onToggleFavourite, showIcons }) {
  const hasNotes = pub.notes && String(pub.notes).trim();
  const hasFood = pub.food && String(pub.food).trim();
  const hoursData = parseHours(pub.openingHours);
  const hasHours = !!hoursData;
  const catMap = {};
  for (const c of categories) catMap[c.name] = c.color;

  let cardClass = 'pub-card';
  if (isFavourite) cardClass += ' pub-favourite';
  if (changeType) cardClass += ' pub-changed';

  const badgeLabel = changeType === 'Added' ? 'NEW' : changeType === 'Edited' ? 'UPDATED' : null;

  return (
    <div className={cardClass}>
      <div className="pub-card-header">
        <div className="pub-name">
          <button className={`btn-fav ${isFavourite ? 'active' : ''}`} onClick={onToggleFavourite} title={isFavourite ? 'Remove favourite' : 'Add favourite'}>
            {isFavourite ? '★' : '☆'}
          </button>
          {pub.mapsLink ? (
            <a href={pub.mapsLink} target="_blank" rel="noopener noreferrer">
              {pub.name}
              <svg className="pub-name-map-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          ) : pub.name}
          {badgeLabel && <span className="pub-change-badge">{badgeLabel}</span>}
        </div>
        <div className="pub-card-actions">
          <button className="btn-icon" onClick={onEdit} title="Edit">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button className="btn-icon" onClick={onDelete} title="Delete">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      <div className="pub-card-meta">
        {pub.area && (
          <span className="pub-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {pub.area}
          </span>
        )}
        <StarRating rating={pub.mapsRating} />
      </div>

      {pub.tags.length > 0 && (
        <div className="pub-tags">
          {pub.tags.map((tag) => {
            const color = catMap[tag] || '#4ecdc4';
            return (
              <span
                key={tag}
                className="pub-tag"
                style={{ background: color + '25', color }}
              >{showIcons && getTagIcon(tag) ? `${getTagIcon(tag)} ` : ''}{tag}</span>
            );
          })}
        </div>
      )}

      <div className="pub-card-footer">
        {hasFood && <div className="pub-food"><strong>Food:</strong> {pub.food}</div>}
        {hasHours && (
          <div className="pub-hours-wrap">
            <strong>Hours:</strong>{' '}
            {hoursData.lines ? (
              <span className="hours-today" tabIndex={0}>
                {hoursData.summary} <span className="hours-hint">(today)</span>
                <div className="hours-tooltip">
                  {hoursData.lines.map((line, i) => (
                    <div key={i} className={line.startsWith(hoursData.today) ? 'hours-today-line' : ''}>{line}</div>
                  ))}
                </div>
              </span>
            ) : (
              <span>{hoursData.summary}</span>
            )}
          </div>
        )}
        {hasNotes && <div className="pub-notes">{pub.notes}</div>}

        <ExtraInfo raw={pub.extraInfo} />

        {pub.addedBy && (
          <div className="pub-added-by">Added by {pub.addedBy}{pub.lastUpdated ? ` · ${pub.lastUpdated}` : ''}</div>
        )}
      </div>
    </div>
  );
}
