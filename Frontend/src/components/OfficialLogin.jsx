import React, { useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const OFFICIAL_PROFILES = [
  {
    role: 'HEAD',
    title: 'AI Complaint Manager',
    subtitle: 'Admin Overall Dashboard (9A) · All Departments & Analytics',
    username: 'head_admin',
    password: 'Head@123',
    icon: '🏛️',
    badge: 'OVERALL ADMIN',
    color: '#173c66',
  },
  {
    role: 'DEPARTMENT',
    title: 'Water Supply & Sewerage Board',
    subtitle: 'Pipe leaks, drainage, contamination & supply issues',
    username: 'water_officer',
    password: 'Water@123',
    icon: '💧',
    badge: 'WATER DEPT',
    color: '#0d7490',
  },
  {
    role: 'DEPARTMENT',
    title: 'Electricity & Power Distribution',
    subtitle: 'Live wire hazards, transformer failure & outages',
    username: 'electricity_officer',
    password: 'Power@123',
    icon: '⚡',
    badge: 'POWER DEPT',
    color: '#b45309',
  },
  {
    role: 'DEPARTMENT',
    title: 'Municipal Corporation & Sanitation',
    subtitle: 'Garbage accumulation, sewage & public hygiene',
    username: 'sanitation_officer',
    password: 'San@123',
    icon: '🗑️',
    badge: 'SANITATION',
    color: '#15803d',
  },
  {
    role: 'DEPARTMENT',
    title: 'Public Works (PWD) & Roads',
    subtitle: 'Potholes, streetlights, road damage & bridges',
    username: 'pwd_officer',
    password: 'Pwd@123',
    icon: '🛣️',
    badge: 'PWD & ROADS',
    color: '#4338ca',
  },
  {
    role: 'DEPARTMENT',
    title: 'Traffic & Urban Mobility',
    subtitle: 'Traffic signal failure, illegal parking & gridlock',
    username: 'traffic_officer',
    password: 'Traffic@123',
    icon: '🚦',
    badge: 'TRAFFIC POLICE',
    color: '#c2410c',
  },
  {
    role: 'DEPARTMENT',
    title: 'Disaster Management Desk',
    subtitle: 'Floods, fallen trees, building collapse & emergency',
    username: 'disaster_officer',
    password: 'Disaster@123',
    icon: '🚨',
    badge: 'DISASTER RESCUE',
    color: '#be123c',
  },
];

export default function OfficialLogin({ onLogin, onSwitchToSimulation }) {
  const [username, setUsername] = useState('head_admin');
  const [password, setPassword] = useState('Head@123');
  const [selectedRoleTitle, setSelectedRoleTitle] = useState('AI Complaint Manager');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSelectProfile = (profile) => {
    setUsername(profile.username);
    setPassword(profile.password);
    setSelectedRoleTitle(profile.title);
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
        body: JSON.stringify({ username, password, portal: 'OFFICIAL' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.detail || 'Invalid official credentials. Please verify your username and password.');
        return;
      }
      onLogin(data);
    } catch (err) {
      setError('Unable to connect to government authentication server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="official-login-page">
      {/* Official Government Masthead Banner */}
      <div className="gov-emblem-banner">
        <div className="gov-emblem-left">
          <div className="national-emblem-badge">
            <span className="emblem-circle">🇮🇳</span>
            <div className="gov-titles">
              <span className="gov-sub">GOVERNMENT SERVICE OPERATIONS</span>
              <b className="gov-main">Citizen Grievance Redressal & Intelligence Portal</b>
            </div>
          </div>
        </div>
        <div className="gov-emblem-right">
          <span className="gov-security-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            NIC 256-BIT ENCRYPTED
          </span>
        </div>
      </div>

      <div className="official-login-layout">
        {/* Left Column: Official Sign-in Form */}
        <div className="official-auth-card">
          <div className="official-card-heading">
            <span className="official-tag">OFFICIAL ACCESS · RESTRICTED TO AUTHORIZED STAFF</span>
            <h1>Government Staff Sign-In</h1>
            <p>
              Sign in with your department or administrative credentials to review incidents, monitor civic triage, update problem resolution, and send SMS updates.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="off-username">
                Official Staff ID / Username
                {selectedRoleTitle && <span className="selected-role-hint">({selectedRoleTitle})</span>}
              </label>
              <input
                id="off-username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setSelectedRoleTitle('');
                }}
                placeholder="e.g. head_admin or water_officer"
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="off-password">Security Password</label>
              <input
                id="off-password"
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

            <button type="submit" className="btn-primary-official" disabled={busy}>
              {busy ? (
                <span className="btn-spinner">Verifying Credentials…</span>
              ) : (
                <>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Sign In to Official Console</span>
                </>
              )}
            </button>
          </form>

          <div className="security-notice-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <p>
              Unauthorized access to this portal is strictly prohibited under IT Act 2000. All activities, status changes, and SMS triggers are logged with officer timestamp.
            </p>
          </div>

          <div className="portal-switch-box official-switch">
            <span>Looking for the Call Simulator / AI Test Rig?</span>
            <button type="button" className="btn-switch-link" onClick={onSwitchToSimulation}>
              Switch to Call Simulation Sign-In →
            </button>
          </div>
        </div>

        {/* Right Column: 1-Click Fast Profile Switcher */}
        <div className="official-profiles-pane">
          <div className="profiles-header">
            <span className="profiles-caption">QUICK DEMO ACCESS</span>
            <h2>Select an Authorized Officer Profile</h2>
            <p>Click any profile below to instantly populate credentials and test role-based access:</p>
          </div>

          <div className="profiles-list">
            {OFFICIAL_PROFILES.map((prof) => {
              const isSelected = username === prof.username;
              return (
                <div
                  key={prof.username}
                  className={`profile-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectProfile(prof)}
                  style={{ borderLeftColor: isSelected ? prof.color : 'transparent' }}
                >
                  <div className="profile-icon-box">{prof.icon}</div>
                  <div className="profile-info">
                    <div className="profile-title-row">
                      <strong>{prof.title}</strong>
                      <span className="profile-badge" style={{ backgroundColor: `${prof.color}18`, color: prof.color }}>
                        {prof.badge}
                      </span>
                    </div>
                    <p>{prof.subtitle}</p>
                    <div className="profile-creds-preview">
                      <span>User: <code>{prof.username}</code></span>
                      <span>Pass: <code>{prof.password}</code></span>
                    </div>
                  </div>
                  <button type="button" className="profile-select-btn" onClick={(e) => { e.stopPropagation(); handleSelectProfile(prof); }}>
                    {isSelected ? '✓ Selected' : 'Select'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
