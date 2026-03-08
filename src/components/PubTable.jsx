import { getTagIcon } from '../tagIcons.js';

export default function PubTable({ pubs, changedPubs, categories, favourites, onToggleFavourite, showIcons, onEdit, onDelete }) {
  return (
    <div className="table-wrap">
      <table className="pub-table">
        <thead>
          <tr>
            <th></th>
            <th>Name</th>
            <th>Area</th>
            <th>Rating</th>
            <th>Tags</th>
            <th>Food</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pubs.map((pub) => {
            const changed = changedPubs[pub.name];
            const isFav = favourites.has(String(pub.name).trim());
            const catMap = {};
            for (const c of categories) catMap[c.name] = c.color;
            return (
              <tr key={pub.rowIndex} className={`${changed ? 'row-changed' : ''} ${isFav ? 'row-favourite' : ''}`}>
                <td>
                  <button className={`btn-fav ${isFav ? 'active' : ''}`} onClick={() => onToggleFavourite(String(pub.name).trim())} title={isFav ? 'Remove favourite' : 'Add favourite'}>
                    {isFav ? '★' : '☆'}
                  </button>
                </td>
                <td className="name-cell">
                  {pub.mapsLink ? (
                    <a href={pub.mapsLink} target="_blank" rel="noopener noreferrer">{pub.name}</a>
                  ) : pub.name}
                  {changed === 'Added' && <span className="pub-change-badge">NEW</span>}
                  {changed === 'Edited' && <span className="pub-change-badge">UPDATED</span>}
                </td>
                <td>{pub.area}</td>
                <td>{pub.mapsRating ?? '-'}</td>
                <td>
                  <div className="pub-tags">
                    {pub.tags.map((tag) => {
                      const color = catMap[tag] || '#4ecdc4';
                      return (
                        <span key={tag} className="pub-tag" style={{ background: color + '25', color }} title={tag}>
                          {getTagIcon(tag) ? <span className="tag-icon">{getTagIcon(tag)}</span> : null}
                          <span className="tag-text">{tag}</span>
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td>{pub.food || '-'}</td>
                <td className="actions-cell">
                  <button className="btn-icon" onClick={() => onEdit(pub)} title="Edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button className="btn-icon" onClick={() => onDelete(pub)} title="Delete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
