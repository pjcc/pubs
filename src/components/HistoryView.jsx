function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function actionColour(action) {
  if (action === 'Added') return 'var(--accent-teal)';
  if (action === 'Deleted') return 'var(--accent)';
  return 'var(--text-muted)';
}

function ActionBadge({ action }) {
  const colour = actionColour(action);
  return (
    <span className="action-badge" style={{ borderColor: colour, color: colour }}>
      {action}
    </span>
  );
}

export default function HistoryView({ history, loading }) {
  if (!history.length) {
    if (loading) return null;
    return (
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <p>No history yet</p>
        <p className="empty-sub">Changes will appear here as people add and edit pubs.</p>
      </div>
    );
  }

  return (
    <div className="history-list">
      {history.map((h, i) => (
        <div key={h.timestamp + i} className="history-item">
          <div className="history-item-header">
            <div>
              <ActionBadge action={h.action} />
              <strong>{h.pub}</strong>
            </div>
            <span className="history-ts">{formatTimestamp(h.timestamp)}</span>
          </div>
          {h.summary && <div className="history-body">{h.summary}</div>}
          <div className="history-user">{h.user}</div>
        </div>
      ))}
    </div>
  );
}
