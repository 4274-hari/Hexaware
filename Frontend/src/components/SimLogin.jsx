import React, { useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function SimLogin({ onLogin, onSwitchToOfficial }) {
  const [username, setUsername] = useState('simulator_demo');
  const [password, setPassword] = useState('Sim@123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleQuickFill = () => {
    setUsername('simulator_demo');
    setPassword('Sim@123');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, portal: 'SIMULATION' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.detail || 'Invalid simulation credentials.');
        return;
      }
      onLogin(data);
    } catch (err) {
      setError('Unable to connect to authentication server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="sim-login-page">
      <div className="sim-login-container">
        {/* Left Side: Simulation Lab Credentials Form */}
        <div className="sim-login-card">
          <div className="sim-login-header">
            <div className="sim-badge">
              <span className="sim-pulse-dot" />
              <span>TESTING & LAB ENVIRONMENT · RESTRICTED</span>
            </div>
            <h1>Call Simulation Sign-In</h1>
            <p>Access the isolated AI intake test rig for audio uploads, live voice capture, automated triage, duplicate detection, and citizen SMS simulation.</p>
          </div>

          <div className="quick-demo-banner">
            <div className="demo-badge-row">
              <span className="demo-tag">DEMO OPERATOR</span>
              <span className="demo-creds">simulator_demo / Sim@123</span>
            </div>
            <button type="button" className="btn-quick-fill" onClick={handleQuickFill}>
              Auto-Fill Test Credentials
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="sim-username">Simulator Operator Username</label>
              <input
                id="sim-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. simulator_demo"
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="sim-password">Password</label>
              <input
                id="sim-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="auth-error-alert" role="alert">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="btn-primary-sim" disabled={busy}>
              {busy ? (
                <span className="btn-spinner">Authenticating…</span>
              ) : (
                <>
                  <span>Launch Simulation Workbench</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="portal-switch-box">
            <span>Are you a Government Officer or District Admin?</span>
            <button type="button" className="btn-switch-link" onClick={onSwitchToOfficial}>
              Switch to Official Operations Sign-In →
            </button>
          </div>
        </div>

        {/* Right Side: Simulation Architecture & Capabilities */}
        <div className="sim-features-sidebar">
          <div className="sidebar-masthead">
            <span className="sidebar-caption">AI CITIZEN CALL INTELLIGENCE</span>
            <h2>Simulation Testing Rig Capabilities</h2>
          </div>

          <div className="feature-grid">
            <div className="feature-item">
              <div className="feature-icon mic">🎙️</div>
              <div className="feature-text">
                <h3>Multi-Modal Voice Ingestion</h3>
                <p>Record voice via browser microphone, upload audio recordings, or trigger one-click preloaded civic scenarios.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon ai">🧠</div>
              <div className="feature-text">
                <h3>Multilingual ASR & AI Classifier</h3>
                <p>Transcribes Indian languages (English, Hindi, Tamil, code-mixed) and predicts Department, Urgency (P1-P4), Hazard Score (1-100) and Landmark.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon dup">🔍</div>
              <div className="feature-text">
                <h3>Intelligent Duplication Engine</h3>
                <p>Identifies repeat callers reporting the same issue and links child tickets to the master incident to prevent duplicate field dispatches.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon sms">📱</div>
              <div className="feature-text">
                <h3>Citizen Smartphone SMS Simulator</h3>
                <p>Interactive virtual smartphone showing citizen SMS receipts and allowing simulated SMS location replies in real-time.</p>
              </div>
            </div>
          </div>

          <div className="sim-notice-card">
            <strong>Simulation Isolation Note:</strong>
            <p>Calls created in this mode are logged to the local test database and dispatch simulated SMS notifications without incurring carrier telephony charges.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
