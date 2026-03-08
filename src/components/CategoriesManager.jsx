import { useState } from 'react';

const PALETTE = [
  '#4caf50', '#ff9800', '#7986cb', '#ef5350', '#a1887f',
  '#ffd54f', '#ab47bc', '#4ecdc4', '#42a5f5', '#ec407a',
  '#66bb6a', '#ffa726', '#7e57c2', '#26c6da', '#8d6e63',
];

function ColorPicker({ value, onChange }) {
  return (
    <div className="color-picker">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          className={`color-swatch ${value === c ? 'active' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}

function CategoryRow({ cat, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cat.name);
  const [color, setColor] = useState(cat.color);

  function handleSave() {
    if (!name.trim()) return;
    onUpdate(cat, name.trim(), color);
    setEditing(false);
  }

  function handleCancel() {
    setName(cat.name);
    setColor(cat.color);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="cat-row cat-row-editing">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <ColorPicker value={color} onChange={setColor} />
        <div className="cat-row-actions">
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!name.trim()}>Save</button>
          <button className="btn btn-secondary btn-sm" onClick={handleCancel}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cat-row">
      <span className="cat-preview" style={{ background: cat.color }}></span>
      <span className="cat-name">{cat.name}</span>
      <div className="cat-row-actions">
        <button className="btn-icon" onClick={() => setEditing(true)} title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button className="btn-icon" onClick={() => onDelete(cat)} title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  );
}

export default function CategoriesManager({ categories, onAdd, onUpdate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PALETTE[0]);

  function handleAdd() {
    if (!newName.trim()) return;
    onAdd(newName.trim(), newColor);
    setNewName('');
    setNewColor(PALETTE[0]);
    setAdding(false);
  }

  return (
    <div className="categories-manager">
      <div className="cat-list">
        {categories.map((cat) => (
          <CategoryRow key={cat.rowIndex} cat={cat} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
        {!categories.length && <p className="cat-empty">No categories yet.</p>}
      </div>

      {adding ? (
        <div className="cat-add-form">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name"
            autoFocus
          />
          <ColorPicker value={newColor} onChange={setNewColor} />
          <div className="cat-row-actions">
            <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={!newName.trim()}>Add</button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setAdding(false); setNewName(''); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-secondary" onClick={() => setAdding(true)} style={{ marginTop: 12 }}>
          + Add category
        </button>
      )}
    </div>
  );
}
