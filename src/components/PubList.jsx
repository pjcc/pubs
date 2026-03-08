import PubCard from './PubCard.jsx';
import PubTable from './PubTable.jsx';

export default function PubList({ pubs, view, changedPubs, categories, favourites, onToggleFavourite, showIcons, onEdit, onDelete, onAdd }) {
  if (!pubs.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🍺</div>
        <p>No pubs found</p>
        <button className="btn btn-primary" onClick={onAdd}>Add your first pub</button>
      </div>
    );
  }

  if (view === 'table') {
    return <PubTable pubs={pubs} changedPubs={changedPubs} categories={categories} favourites={favourites} onToggleFavourite={onToggleFavourite} showIcons={showIcons} onEdit={onEdit} onDelete={onDelete} />;
  }

  return (
    <div className="pub-grid">
      {pubs.map((pub) => (
        <PubCard
          key={pub.rowIndex}
          pub={pub}
          changeType={changedPubs[pub.name]}
          categories={categories}
          isFavourite={favourites.has(String(pub.name).trim())}
          onToggleFavourite={() => onToggleFavourite(String(pub.name).trim())}
          showIcons={showIcons}
          onEdit={() => onEdit(pub)}
          onDelete={() => onDelete(pub)}
        />
      ))}
    </div>
  );
}
