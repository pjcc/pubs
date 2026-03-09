import { getTagIcon } from '../tagIcons.js';

const THEMES = [
  { id: 'midnight', label: 'Midnight' },
  { id: 'copper', label: 'Copper' },
  { id: 'forest', label: 'Forest' },
  { id: 'slate', label: 'Slate' },
  { id: 'sand', label: 'Sand' },
];

export default function Header({
  onAdd, onSignOut,
  view, onViewChange, theme, onThemeChange,
  userName, unseenCount, pubs,
  search, onSearchChange, filters, onFiltersChange,
  sortBy, onSortChange,
  categories, onManageCategories,
  showIcons, onToggleIcons,
}) {
  function toggleFilter(name) {
    onFiltersChange({ ...filters, [name]: !filters[name] });
  }

  return (
    <header className="header">
      <div className="theme-switcher">
        {THEMES.map((t) => (
          <button
            key={t.id}
            className={`theme-pill ${theme === t.id ? 'active' : ''}`}
            onClick={() => onThemeChange(t.id)}
          >{t.label}</button>
        ))}
      </div>

      <div className="header-top">
        <h1 className="header-title">Pubs</h1>
        <div className="header-user">
          <span className="user-name">{userName}</span>
          <button className="btn btn-ghost" onClick={onSignOut}>Sign out</button>
        </div>
      </div>

      <div className="header-nav">
        <div className="view-toggles">
          <button
            className={`btn btn-ghost ${view === 'cards' ? 'active' : ''}`}
            onClick={() => onViewChange('cards')}
          >Cards</button>
          <button
            className={`btn btn-ghost ${view === 'map' ? 'active' : ''}`}
            onClick={() => onViewChange('map')}
          >Map</button>
          <button
            className={`btn btn-ghost ${view === 'table' ? 'active' : ''}`}
            onClick={() => onViewChange('table')}
          >Table</button>
          <button
            className={`btn btn-ghost ${view === 'history' ? 'active' : ''}`}
            onClick={() => onViewChange('history')}
          >
            History
            {unseenCount > 0 && <span className="unseen-badge">{unseenCount}</span>}
          </button>
        </div>

        <div className="header-actions">
          <button
            className={`btn btn-ghost ${showIcons ? 'active' : ''}`}
            onClick={onToggleIcons}
            title="Toggle emoji icons"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </button>
          <button className="btn btn-primary" onClick={onAdd}><span className="add-label-full">+ Add Pub</span><span className="add-label-short">+</span></button>
        </div>
      </div>

      {view !== 'history' && (
        <div className="header-filters">
          <div className="search-row">
            <div className="search-wrap">
              <input
                type="text"
                className="search-input"
                placeholder="Search pubs..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />
              {search && (
                <button className="search-clear" onClick={() => onSearchChange('')} type="button" aria-label="Clear search">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
            <button
              className={`chip chip-sort ${sortBy === 'name' ? 'active' : ''}`}
              onClick={() => onSortChange('name')}
            >A-Z</button>
            <button
              className={`chip chip-sort ${sortBy === 'rating' ? 'active' : ''}`}
              onClick={() => onSortChange('rating')}
            >Top Rated</button>
          </div>
          <div className="filter-chips">
            {[...categories].sort((a, b) => {
              const countA = pubs.filter((p) => p.tags.includes(a.name)).length;
              const countB = pubs.filter((p) => p.tags.includes(b.name)).length;
              return countB - countA;
            }).map((cat) => {
              const icon = showIcons ? getTagIcon(cat.name) : null;
              return (
                <button
                  key={cat.name}
                  className={`chip ${filters[cat.name] ? 'active' : ''}`}
                  data-color
                  style={{
                    '--chip-color': cat.color,
                    ...(filters[cat.name] ? { borderColor: cat.color, color: cat.color, background: cat.color + '18' } : {}),
                  }}
                  onClick={() => toggleFilter(cat.name)}
                >{icon ? `${icon} ` : ''}{cat.name}</button>
              );
            })}
            {categories.length > 0 && <button className="chip chip-manage" onClick={onManageCategories} title="Manage categories">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>}
          </div>
        </div>
      )}
    </header>
  );
}
