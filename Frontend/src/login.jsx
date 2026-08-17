import React, { useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const DEMO_PERSONAS = [
  { id: 'head_admin', label: 'AI Complaint Manager', pass: 'Head@123', portal: 'OFFICIAL', role: 'HEAD', dept: null, name: 'AI Complaint Manager', icon: '🏛️', tag: 'ADMIN' },
  { id: 'water_officer', label: 'Water Supply Board', pass: 'Water@123', portal: 'OFFICIAL', role: 'DEPARTMENT', dept: 'Water Supply & Sewerage Board', name: 'Water Board Officer', icon: '💧', tag: 'WATER' },
  { id: 'electricity_officer', label: 'Electricity & Power', pass: 'Power@123', portal: 'OFFICIAL', role: 'DEPARTMENT', dept: 'Electricity & Power Distribution', name: 'Electricity Officer', icon: '⚡', tag: 'POWER' },
  { id: 'sanitation_officer', label: 'Municipal Sanitation', pass: 'San@123', portal: 'OFFICIAL', role: 'DEPARTMENT', dept: 'Municipal Corporation & Sanitation', name: 'Sanitation Officer', icon: '🗑️', tag: 'SANITATION' },
  { id: 'pwd_officer', label: 'Public Works (PWD)', pass: 'Pwd@123', portal: 'OFFICIAL', role: 'DEPARTMENT', dept: 'Public Works (PWD) & Roads', name: 'PWD Officer', icon: '🛣️', tag: 'PWD' },
  { id: 'traffic_officer', label: 'Traffic Police', pass: 'Traffic@123', portal: 'OFFICIAL', role: 'DEPARTMENT', dept: 'Traffic & Urban Mobility', name: 'Traffic Officer', icon: '🚦', tag: 'TRAFFIC' },
  { id: 'disaster_officer', label: 'Disaster Rescue', pass: 'Disaster@123', portal: 'OFFICIAL', role: 'DEPARTMENT', dept: 'Disaster Management', name: 'Disaster Management Officer', icon: '🚨', tag: 'DISASTER' },
  { id: 'simulator_demo', label: 'Simulation Operator', pass: 'Sim@123', portal: 'SIMULATION', role: 'SIMULATOR', dept: null, name: 'Simulation Operator', icon: '🎙️', tag: 'SIMULATOR' },
];

export default function Login({ onLogin }) {
  const [portal, setPortal] = useState('OFFICIAL'); // 'OFFICIAL' | 'SIMULATION'
  const [username, setUsername] = useState('head_admin');
  const [password, setPassword] = useState('Head@123');
  const [showPassword, setShowPassword] = useState(false);
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
      if (res.ok && data?.access_token) {
        onLogin(data);
        return;
      }
      if (!res.ok && data?.detail) {
        setError(data.detail);
        return;
      }
    } catch (err) {
      // Backend not running on port 8000 -> Check local demo credentials
      const matched = DEMO_PERSONAS.find((p) => p.id === username && p.pass === password);
      if (matched) {
        if (portal === 'SIMULATION' && matched.role !== 'SIMULATOR') {
          setError('Use a Simulation Operator account for the simulation portal.');
          setBusy(false);
          return;
        }
        if (portal === 'OFFICIAL' && matched.role === 'SIMULATOR') {
          setError('Simulation accounts must sign in through the simulation portal.');
          setBusy(false);
          return;
        }
        const sessionPayload = {
          access_token: `demo-token-${matched.id}`,
          token_type: 'bearer',
          user: {
            sub: matched.id,
            role: matched.role,
            department: matched.dept,
            name: matched.name,
          },
        };
        onLogin(sessionPayload);
        return;
      }
      setError('Invalid username or password. Please select a demo persona or verify credentials.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fancy-login-canvas">
      <div className="fancy-login-card">
        {/* Brand & Masthead */}
        <div className="fancy-masthead">
          <div className="fancy-logo-wrap">
            <span className="fancy-logo-icon">🏛️</span>
            <div className="fancy-brand-text">
              <span className="corporate-sub">Government Operations Platform</span>
              <h1>Citizen Grievance Redressal Portal</h1>
            </div>
          </div>
          <p className="fancy-tagline">
            AI Citizen Call Intelligence, Automated Civic Triage &amp; Duplicate Resolution Desk
          </p>
        </div>

        {/* Segmented Portal Switcher */}
        <div className="fancy-segmented-control" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={portal === 'OFFICIAL'}
            className={`seg-btn ${portal === 'OFFICIAL' ? 'active' : ''}`}
            onClick={() => handleSwitchPortal('OFFICIAL')}
          >
            <span>🏢 Official Operations Console</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={portal === 'SIMULATION'}
            className={`seg-btn ${portal === 'SIMULATION' ? 'active' : ''}`}
            onClick={() => handleSwitchPortal('SIMULATION')}
          >
            <span>🎙️ AI Call Lab &amp; Simulator</span>
          </button>
        </div>

        {/* 1-Click Fast Persona Selector Chips */}
        <div className="persona-chips-section">
          <div className="chips-label-row">
            <span>QUICK-SELECT DEMO PERSONA:</span>
            <small>Click to auto-fill credentials</small>
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
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="btn-clear"
                style={{ right: '12px' }}
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {error && <div className="fancy-error-banner" role="alert">{error}</div>}

          <button type="submit" className="btn-fancy-submit" disabled={busy}>
            {busy ? (
              <span className="loading-text">Verifying Credentials…</span>
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
          <span>Authorized Government &amp; Municipal Personnel Only</span>
        </div>
      </div>
    </div>
  );
}
