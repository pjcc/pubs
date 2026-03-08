import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getSavedSession, saveSession, clearSession,
  checkPassword, fetchAll,
  addPub, updatePub, removePub,
  addCategory as apiAddCategory,
  updateCategory as apiUpdateCategory,
  deleteCategory as apiDeleteCategory,
  buildDiffSummary, logEvent, logVisitIfStale,
} from './services/api.js';
import Header from './components/Header.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import PubList from './components/PubList.jsx';
import PubForm from './components/PubForm.jsx';
import HistoryView from './components/HistoryView.jsx';
import CategoriesManager from './components/CategoriesManager.jsx';
import MapView from './components/MapView.jsx';
import BulkAddForm from './components/BulkAddForm.jsx';
import Modal from './components/Modal.jsx';
import Toast from './components/Toast.jsx';

export default function App() {
  const [session, setSession] = useState(null);
  const [initialising, setInitialising] = useState(true);
  const [loginError, setLoginError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pubs, setPubs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [history, setHistory] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPub, setEditingPub] = useState(null);
  const [deletingPub, setDeletingPub] = useState(null);
  const [showCategories, setShowCategories] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [view, setView] = useState(() =>
    localStorage.getItem('brighton-pubs-view') || 'cards'
  );
  const [toast, setToast] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [filters, setFilters] = useState({});
  const [lastSeen, setLastSeen] = useState(() =>
    localStorage.getItem('brighton-pubs-last-seen') || '0'
  );
  const [favourites, setFavourites] = useState(new Set());
  const [showIcons, setShowIcons] = useState(() =>
    localStorage.getItem('brighton-pubs-show-icons') !== 'false'
  );
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('brighton-pubs-theme');
    if (saved === 'dark') return 'midnight';
    if (saved === 'light') return 'sand';
    return saved || 'forest';
  });

  const unseenChanges = useMemo(() => {
    if (!session || !history.length) return [];
    return history.filter((h) => {
      if (!h.timestamp) return false;
      const isAction = h.action === 'Added' || h.action === 'Edited' || h.action === 'Deleted';
      const isOther = String(h.user || '').toLowerCase() !== session.name.toLowerCase();
      return isAction && isOther && h.timestamp > lastSeen;
    });
  }, [history, session, lastSeen]);

  const changedPubs = useMemo(() => {
    const map = {};
    for (const entry of unseenChanges) {
      const key = entry.pub;
      if (key && !map[key]) map[key] = entry.action;
    }
    return map;
  }, [unseenChanges]);

  function markAsSeen() {
    const now = new Date().toISOString();
    setLastSeen(now);
    localStorage.setItem('brighton-pubs-last-seen', now);
  }

  function handleViewChange(newView) {
    if (newView === 'history') markAsSeen();
    setView(newView);
    localStorage.setItem('brighton-pubs-view', newView);
  }

  useEffect(() => {
    if (theme === 'midnight') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('brighton-pubs-theme', theme);
  }, [theme]);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const saved = getSavedSession();
    if (saved) {
      setSession(saved);
      logVisitIfStale(saved.password, saved.name);
      try {
        const raw = localStorage.getItem(`brighton-pubs-favs-${saved.name.toLowerCase()}`);
        if (raw) setFavourites(new Set(JSON.parse(raw)));
      } catch {}
    }
    setInitialising(false);
  }, []);

  useEffect(() => {
    if (session) loadData();
  }, [session]);

  async function loadData(silent = false) {
    if (!session) return;
    if (!silent) setLoading(true);
    try {
      const data = await fetchAll(session.password);
      setPubs(data.pubs);
      setCategories(data.categories || []);
      setHistory(data.history);
    } catch (err) {
      if (err.message?.includes('Invalid password')) {
        clearSession();
        setSession(null);
        setLoginError('Session expired. Please sign in again.');
      } else if (!silent) {
        showToast('Failed to load data', 'error');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function handleLogin(name, password) {
    setLoginError(null);
    try {
      const valid = await checkPassword(password);
      if (valid) {
        saveSession(name, password);
        setSession({ name, password });
        logEvent(password, name, 'Logged in', '');
      } else {
        setLoginError('Incorrect password');
      }
    } catch {
      setLoginError('Could not connect. Check the script URL.');
    }
  }

  function handleSignOut() {
    clearSession();
    setSession(null);
    setPubs([]);
    setCategories([]);
    setHistory([]);
  }

  function isDuplicate(pub) {
    const name = String(pub.name).trim().toLowerCase();
    const link = String(pub.mapsLink || '').trim().toLowerCase();
    return pubs.some((p) => {
      if (String(p.name).trim().toLowerCase() === name) return true;
      if (link && String(p.mapsLink || '').trim().toLowerCase() === link) return true;
      return false;
    });
  }

  // Pub CRUD (optimistic)
  async function handleAddPub(pub, { silent } = {}) {
    if (isDuplicate(pub)) {
      if (!silent) {
        showToast(`"${pub.name}" already exists`, 'error');
      }
      return 'duplicate';
    }
    const temp = { ...pub, rowIndex: Date.now() };
    setPubs((prev) => [...prev, temp]);
    if (!silent) {
      setShowForm(false);
      showToast(`Added "${pub.name}"`);
    }
    try {
      await addPub(session.password, session.name, pub);
      if (!silent) loadData(true);
    } catch {
      showToast('Failed to save - refreshing...', 'error');
      if (!silent) loadData(true);
    }
  }

  async function handleUpdatePub(pub) {
    const summary = editingPub ? buildDiffSummary(editingPub, pub) : 'Updated';
    setPubs((prev) => prev.map((p) => (p.rowIndex === pub.rowIndex ? { ...pub } : p)));
    setEditingPub(null);
    setShowForm(false);
    showToast(`Updated "${pub.name}"`);
    try {
      await updatePub(session.password, session.name, pub, summary);
    } catch {
      showToast('Failed to save - refreshing...', 'error');
      loadData(true);
    }
  }

  async function handleDeletePub() {
    if (!deletingPub) return;
    const { name, rowIndex } = deletingPub;
    setPubs((prev) => prev.filter((p) => p.rowIndex !== rowIndex));
    setDeletingPub(null);
    showToast(`Deleted "${name}"`);
    try {
      await removePub(session.password, session.name, deletingPub);
      loadData(true);
    } catch {
      showToast('Failed to delete - refreshing...', 'error');
      loadData(true);
    }
  }

  // Category CRUD
  async function handleAddCategory(name, color) {
    setCategories((prev) => [...prev, { rowIndex: Date.now(), name, color }]);
    try {
      await apiAddCategory(session.password, name, color);
      loadData(true);
    } catch {
      showToast('Failed to save category', 'error');
      loadData(true);
    }
  }

  async function handleUpdateCategory(cat, newName, newColor) {
    setCategories((prev) => prev.map((c) =>
      c.rowIndex === cat.rowIndex ? { ...c, name: newName, color: newColor } : c
    ));
    if (cat.name !== newName) {
      setPubs((prev) => prev.map((p) => ({
        ...p,
        tags: p.tags.map((t) => t === cat.name ? newName : t),
      })));
    }
    try {
      await apiUpdateCategory(session.password, cat.rowIndex, newName, newColor, cat.name);
      loadData(true);
    } catch {
      showToast('Failed to update category', 'error');
      loadData(true);
    }
  }

  async function handleDeleteCategory(cat) {
    setCategories((prev) => prev.filter((c) => c.rowIndex !== cat.rowIndex));
    setPubs((prev) => prev.map((p) => ({
      ...p,
      tags: p.tags.filter((t) => t !== cat.name),
    })));
    try {
      await apiDeleteCategory(session.password, cat.rowIndex, cat.name);
      loadData(true);
    } catch {
      showToast('Failed to delete category', 'error');
      loadData(true);
    }
  }

  function toggleIcons() {
    setShowIcons((v) => {
      localStorage.setItem('brighton-pubs-show-icons', String(!v));
      return !v;
    });
  }

  function toggleFavourite(pubName) {
    const key = String(pubName).trim();
    setFavourites((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (session) {
        localStorage.setItem(
          `brighton-pubs-favs-${session.name.toLowerCase()}`,
          JSON.stringify([...next])
        );
      }
      return next;
    });
  }

  // Filter pubs
  const filteredPubs = useMemo(() => {
    let list = pubs;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q) ||
        p.notes.toLowerCase().includes(q)
      );
    }
    const activeTags = Object.entries(filters).filter(([, v]) => v).map(([k]) => k);
    if (activeTags.length) {
      list = list.filter((p) => activeTags.every((t) => p.tags.includes(t)));
    }
    return list.sort((a, b) => {
      const aFav = favourites.has(String(a.name).trim());
      const bFav = favourites.has(String(b.name).trim());
      if (aFav !== bFav) return aFav ? -1 : 1;
      if (sortBy === 'rating') {
        const ar = a.mapsRating ?? 0;
        const br = b.mapsRating ?? 0;
        if (br !== ar) return br - ar;
      }
      return String(a.name).localeCompare(String(b.name));
    });
  }, [pubs, search, filters, favourites, sortBy]);

  if (initialising) {
    return (
      <div className="app">
        <div className="loading"><div className="spinner" />Loading...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app">
        <LoginScreen onLogin={handleLogin} error={loginError} />
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        onAdd={() => { setEditingPub(null); setShowForm(true); }}
        onSignOut={handleSignOut}
        onRefresh={async () => { setRefreshing(true); await loadData(true); setRefreshing(false); }}
        refreshing={refreshing}
        view={view}
        onViewChange={handleViewChange}
        theme={theme}
        onThemeChange={setTheme}
        userName={session.name}
        unseenCount={unseenChanges.length}
        pubs={pubs}
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFiltersChange={setFilters}
        sortBy={sortBy}
        onSortChange={setSortBy}
        categories={categories}
        onManageCategories={() => setShowCategories(true)}
        showIcons={showIcons}
        onToggleIcons={toggleIcons}
      />

      {loading ? (
        <div className="loading"><div className="spinner" />Loading pubs...</div>
      ) : view === 'history' ? (
        <HistoryView history={history} />
      ) : view === 'map' ? (
        <MapView pubs={pubs} theme={theme} showIcons={showIcons} />
      ) : (
        <PubList
          pubs={filteredPubs}
          view={view}
          changedPubs={changedPubs}
          categories={categories}
          favourites={favourites}
          onToggleFavourite={toggleFavourite}
          showIcons={showIcons}
          onEdit={(pub) => { setEditingPub(pub); setShowForm(true); }}
          onDelete={(pub) => setDeletingPub(pub)}
          onAdd={() => { setEditingPub(null); setShowForm(true); }}
        />
      )}

      {!loading && view !== 'history' && (
        <div className="pub-count">
          {filteredPubs.length !== pubs.length
            ? `${filteredPubs.length} of ${pubs.length} pubs`
            : `${pubs.length} pubs`}
        </div>
      )}

      {showForm && (
        <Modal
          title={editingPub ? 'Edit Pub' : bulkMode ? 'Bulk Add Pubs' : 'Add Pub'}
          onClose={() => { setShowForm(false); setEditingPub(null); setBulkMode(false); }}
        >
          {!editingPub && (
            <div className="mode-toggle">
              <button className={`btn btn-ghost ${!bulkMode ? 'active' : ''}`} onClick={() => setBulkMode(false)}>Single</button>
              <button className={`btn btn-ghost ${bulkMode ? 'active' : ''}`} onClick={() => setBulkMode(true)}>Bulk</button>
            </div>
          )}
          {bulkMode && !editingPub ? (
            <BulkAddForm
              password={session.password}
              onAdd={handleAddPub}
              onDone={() => loadData(true)}
              onCancel={() => { setShowForm(false); setBulkMode(false); }}
            />
          ) : (
            <PubForm
              key={editingPub ? `edit-${editingPub.rowIndex}` : 'add'}
              pub={editingPub}
              password={session.password}
              categories={categories}
              showIcons={showIcons}
              existingPubs={pubs}
              onSubmit={editingPub ? handleUpdatePub : handleAddPub}
              onCancel={() => { setShowForm(false); setEditingPub(null); }}
            />
          )}
        </Modal>
      )}

      {showCategories && (
        <Modal title="Manage Categories" onClose={() => setShowCategories(false)}>
          <CategoriesManager
            categories={categories}
            onAdd={handleAddCategory}
            onUpdate={handleUpdateCategory}
            onDelete={handleDeleteCategory}
          />
        </Modal>
      )}

      {deletingPub && (
        <Modal title="Delete Pub" onClose={() => setDeletingPub(null)}>
          <div className="confirm-delete">
            <p>Are you sure you want to delete this pub?</p>
            <p className="band-name">{deletingPub.name}</p>
          </div>
          <div className="modal-footer" style={{ borderTop: 'none', paddingTop: 0 }}>
            <button className="btn btn-secondary" onClick={() => setDeletingPub(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleDeletePub}>Delete</button>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
