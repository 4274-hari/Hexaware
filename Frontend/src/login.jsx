import React, { useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const DEMO_PERSONAS = [
  { id: 'head_admin', label: 'District Head (Admin)', pass: 'Head@123', portal: 'OFFICIAL', icon: '🏛️', tag: 'ADMIN' },
  { id: 'water_officer', label: 'Water Supply Board', pass: 'Water@123', portal: 'OFFICIAL', icon: '💧', tag: 'WATER' },
  { id: 'electricity_officer', label: 'Electricity & Power', pass: 'Power@123', portal: 'OFFICIAL', icon: '⚡', tag: 'POWER' },
  { id: 'sanitation_officer', label: 'Municipal Sanitation', pass: 'San@123', portal: 'OFFICIAL', icon: '🗑️', tag: 'SANITATION' },
  { id: 'pwd_officer', label: 'Public Works (PWD)', pass: 'Pwd@123', portal: 'OFFICIAL', icon: '🛣️', tag: 'PWD' },
  { id: 'traffic_officer', label: 'Traffic Police', pass: 'Traffic@123', portal: 'OFFICIAL', icon: '🚦', tag: 'TRAFFIC' },
  { id: 'disaster_officer', label: 'Disaster Rescue', pass: 'Disaster@123', portal: 'OFFICIAL', icon: '🚨', tag: 'DISASTER' },
  { id: 'simulator_demo', label: 'Simulation Operator', pass: 'Sim@123', portal: 'SIMULATION', icon: '🎙️', tag: 'SIMULATOR' },
];

export default function Login({ onLogin }) {
  const [portal, setPortal] = useState('OFFICIAL'); // 'OFFICIAL' | 'SIMULATION'
  const [username, setUsername] = useState('head_admin');
  const [password, setPassword] = useState('Head@123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSwitchPortal = (p) => {
    setPortal(p);
    setError('');
    if (p === 'SIMULATION') {
      setUsername('simulator_demo');
      setPassword('Sim@123');
    } else {
      setUsername('head_admin');
      setPassword('Head@123');
    }
  };

  const handleSelectPersona = (persona) => {
    setPortal(persona.portal);
    setUsername(persona.id);
    setPassword(persona.pass);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, portal }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || 'Authentication failed. Please verify credentials.');
        return;
      }
      onLogin(data);
    } catch (err) {
      setError('Unable to establish secure connection to auth service.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fancy-login-canvas">
      {/* Background ambient lighting glow */}
      <div className="ambient-glow top-glow" />
      <div className="ambient-glow bottom-glow" />

      <div className="fancy-login-card">
        {/* Brand & Masthead */}
        <div className="fancy-masthead">
          <div className="fancy-logo-wrap">
            <span className="fancy-logo-icon">🏛️</span>
            <div className="fancy-brand-text">
              <span className="corporate-sub">GOVPULSE ENTERPRISE · CENTRAL COMMAND</span>
              <h1>Citizen Grievance Portal</h1>
            </div>
          </div>
          <p className="fancy-tagline">
            AI Citizen Call Intelligence, Automated Civic Triage &amp; Duplicate Resolution Platform
          </p>
        </div>

        {/* Segmented Portal Switcher */}
        <div className="fancy-segmented-control">
          <button
            type="button"
            className={`seg-btn ${portal === 'OFFICIAL' ? 'active' : ''}`}
            onClick={() => handleSwitchPortal('OFFICIAL')}
          >
            <span>🏢 Official Operations Portal</span>
          </button>
          <button
            type="button"
            className={`seg-btn ${portal === 'SIMULATION' ? 'active' : ''}`}
            onClick={() => handleSwitchPortal('SIMULATION')}
          >
            <span>🎙️ AI Call Lab &amp; Simulator</span>
          </button>
        </div>

        {/* 1-Click Fast Persona Selector Chips */}
        <div className="persona-chips-section">
          <div className="chips-label-row">
            <span>FAST DEMO PERSONAS:</span>
            <small>Click to instant-fill</small>
          </div>
          <div className="chips-grid">
            {DEMO_PERSONAS.map((item) => {
              const isSelected = username === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`persona-chip ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectPersona(item)}
                >
                  <span className="chip-icon">{item.icon}</span>
                  <span className="chip-name">{item.label}</span>
                  <span className="chip-tag">{item.tag}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="fancy-auth-form">
          <div className="fancy-field-group">
            <label htmlFor="auth-username">Official Identifier / Staff ID</label>
            <div className="input-with-icon">
              <span className="input-icon">👤</span>
              <input
                id="auth-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username or Staff ID"
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div className="fancy-field-group">
            <label htmlFor="auth-password">Security Password</label>
            <div className="input-with-icon">
              <span className="input-icon">🔒</span>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && <div className="fancy-error-banner">{error}</div>}

          <button type="submit" className="btn-fancy-submit" disabled={busy}>
            {busy ? (
              <span className="loading-text">Authenticating with Central DB…</span>
            ) : (
              <>
                <span>{portal === 'SIMULATION' ? 'Launch Call Simulator Workbench' : 'Access Official Command Console'}</span>
                <span className="btn-arrow">→</span>
              </>
            )}
          </button>
        </form>

        {/* Security / System Footer */}
        <div className="fancy-footer-security">
          <span className="sec-badge">🛡️ 256-BIT ENCRYPTED</span>
          <span>Internal Government Intelligence System · Authorized Staff Only</span>
        </div>
      </div>
    </div>
  );
}
