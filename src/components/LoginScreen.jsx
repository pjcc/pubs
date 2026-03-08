import { useState } from 'react';

export default function LoginScreen({ onLogin, error }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !password) return;
    setSubmitting(true);
    await onLogin(name.trim(), password);
    setSubmitting(false);
  }

  const isValid = name.trim() && password;

  return (
    <div className="login-screen">
      <h1>Pubs</h1>
      <p className="login-tagline">A crowd-sourced pub guide</p>
      <form className="login-form" onSubmit={handleSubmit}>
        <label>
          Your name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex"
            autoFocus
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Shared password"
            required
          />
        </label>
        {error && <div className="login-error">{error}</div>}
        <button className="btn btn-primary" disabled={!isValid || submitting}>
          {submitting ? 'Checking...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
