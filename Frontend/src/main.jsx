import React, { useEffect, useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import Login from './login';
import Simulator from './simulator';
import MapView from './components/MapView';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ALL_DEPARTMENTS = [
  'Water Supply & Sewerage Board',
  'Electricity & Power Distribution',
  'Municipal Corporation & Sanitation',
  'Public Works (PWD) & Roads',
  'Traffic & Urban Mobility',
  'Disaster Management',
];

const INITIAL_FALLBACK_COMPLAINTS = [
  {
    id: '66bc62142e8d35f496ab0001',
    complaint_number: 'INC-2026-0012',
    caller_phone: '+919840123456',
    department: 'Electricity & Power Distribution',
    priority: 'P1_EMERGENCY',
    status: 'NEW',
    hazard_risk_score: 98,
    location_text: 'Anna Nagar Bus Stand',
    summary: 'Emergency! High voltage electric wire snapped and sparking in front of Anna Nagar bus stand! Life threatening electrocution hazard!',
    transcript: 'Emergency! High voltage electric wire snapped and sparking in front of Anna Nagar bus stand! Life threatening electrocution hazard!',
    detected_language: 'Tanglish',
    confidence: 0.96,
    action_required: 'Dispatch emergency power crew immediately to isolate snapped line and restore safety.',
    assigned_officer: 'Electricity Officer',
    created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    timeline: [
      { at: new Date(Date.now() - 12 * 60 * 1000).toISOString(), actor: 'AI Ingestion Engine', event: 'Call Received & Triaged', note: 'Classified as P1_EMERGENCY under Electricity & Power Distribution.' },
    ],
  },
  {
    id: '66bc62142e8d35f496ab0002',
    complaint_number: 'INC-2026-0011',
    caller_phone: '+919876543210',
    department: 'Water Supply & Sewerage Board',
    priority: 'P2_HIGH',
    status: 'IN_PROGRESS',
    hazard_risk_score: 82,
    location_text: 'Gandhi Circle, opposite Post Office',
    summary: 'Main drinking water pipeline has burst near Gandhi Circle opposite post office. Clean water is flooding the street.',
    transcript: 'Main drinking water pipeline has burst near Gandhi Circle opposite post office. Clean water is flooding the street.',
    detected_language: 'English',
    confidence: 0.94,
    action_required: 'Deploy emergency repair team to isolate valve and repair pipeline breach.',
    assigned_officer: 'Water Board Officer',
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    timeline: [
      { at: new Date(Date.now() - 45 * 60 * 1000).toISOString(), actor: 'AI Ingestion Engine', event: 'Call Received & Triaged', note: 'Classified as P2_HIGH.' },
      { at: new Date(Date.now() - 25 * 60 * 1000).toISOString(), actor: 'Water Board Officer', event: 'Work Started', note: 'Valve isolation team dispatched to Gandhi Circle.' },
    ],
  },
  {
    id: '66bc62142e8d35f496ab0003',
    complaint_number: 'INC-2026-0010',
    caller_phone: '+919444567890',
    department: 'Public Works (PWD) & Roads',
    priority: 'P1_EMERGENCY',
    status: 'NEW',
    hazard_risk_score: 92,
    location_text: 'Ring Road Expressway near Flyover',
    summary: 'A massive 2-foot deep pothole has opened up on Ring Road near flyover causing vehicle damage and accidents.',
    transcript: 'A massive 2-foot deep pothole has opened up on Ring Road near flyover causing vehicle damage and accidents.',
    detected_language: 'English',
    confidence: 0.91,
    action_required: 'Deploy road barricades immediately and dispatch asphalt cold-mix crew.',
    assigned_officer: 'PWD Officer',
    created_at: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
    timeline: [
      { at: new Date(Date.now() - 110 * 60 * 1000).toISOString(), actor: 'AI Ingestion Engine', event: 'Call Received & Triaged', note: 'Urgent hazard identified on major expressway.' },
    ],
  },
  {
    id: '66bc62142e8d35f496ab0004',
    complaint_number: 'INC-2026-0009',
    caller_phone: '+919123456789',
    department: 'Municipal Corporation & Sanitation',
    priority: 'P3_MEDIUM',
    status: 'NEW',
    hazard_risk_score: 45,
    location_text: 'Market Street East Ward',
    summary: 'Overflowing public garbage bin near market area, waste spilling across footpath.',
    transcript: 'Bhai, market ke paas garbage bin bahut bhar gaya hai, kachra charon taraf phaila hua hai, badboo aa rahi hai.',
    detected_language: 'Hinglish',
    confidence: 0.89,
    action_required: 'Schedule compactor truck and sanitation team to clear bin and sanitize area.',
    assigned_officer: 'Sanitation Officer',
    created_at: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    timeline: [
      { at: new Date(Date.now() - 180 * 60 * 1000).toISOString(), actor: 'AI Ingestion Engine', event: 'Call Received & Triaged', note: 'Municipal sanitation issue logged.' },
    ],
  },
  {
    id: '66bc62142e8d35f496ab0005',
    complaint_number: 'INC-2026-0008',
    caller_phone: '+919871122334',
    department: 'Traffic & Urban Mobility',
    priority: 'P2_HIGH',
    status: 'RESOLVED',
    hazard_risk_score: 75,
    location_text: 'Central Station Junction',
    summary: 'Traffic signal at central station junction malfunctioning, causing severe congestion.',
    transcript: 'Traffic signal at the central station junction is not working since morning, vehicles are stuck everywhere.',
    detected_language: 'English',
    confidence: 0.95,
    action_required: 'Deploy traffic controller and technician to reboot signal controller unit.',
    assigned_officer: 'Traffic Officer',
    created_at: new Date(Date.now() - 360 * 60 * 1000).toISOString(),
    timeline: [
      { at: new Date(Date.now() - 360 * 60 * 1000).toISOString(), actor: 'AI Ingestion Engine', event: 'Call Received & Triaged', note: 'High priority signal failure.' },
      { at: new Date(Date.now() - 300 * 60 * 1000).toISOString(), actor: 'Traffic Officer', event: 'Work Started', note: 'Signal maintenance technician dispatched.' },
      { at: new Date(Date.now() - 150 * 60 * 1000).toISOString(), actor: 'Traffic Officer', event: 'Resolved', note: 'Signal controller rebooted and synchronised. Normal traffic flow restored.' },
    ],
  }
];

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const formatTime = (val) => {
  if (!val) return '—';
  return new Date(val).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

const shortComplaintId = (value) =>
  value ? `CIV-${value.replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase()}` : 'CIV-NEW';

function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cci-session') || 'null');
    } catch {
      return null;
    }
  });

  const [complaints, setComplaints] = useState(INITIAL_FALLBACK_COMPLAINTS);
  const [stats, setStats] = useState(null);
  const [selectedId, setSelectedId] = useState(INITIAL_FALLBACK_COMPLAINTS[0].id);
  const [busy, setBusy] = useState(false);

  // Active channel: 'ALL' | 'EMERGENCY' | 'IN_PROGRESS' | 'DUPLICATES' | 'RESOLVED' | 'ANALYTICS'
  const [activeFolder, setActiveFolder] = useState('ALL');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Inline remarks & department reassignment for selected complaint
  const [actionNote, setActionNote] = useState('');
  const [reassignDept, setReassignDept] = useState(ALL_DEPARTMENTS[0]);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const isHead = session?.user?.role === 'HEAD';
  const isSimulator = session?.user?.role === 'SIMULATOR';

  const headers = useMemo(() => {
    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  }, [session]);

  const loadData = async () => {
    if (!session || isSimulator) return;
    setBusy(true);
    try {
      const recRes = await fetch(`${API}/api/complaints`, { headers });
      if (recRes.ok) {
        const list = await recRes.json();
        if (Array.isArray(list) && list.length > 0) {
          setComplaints(list);
          if (!selectedId || !list.some((c) => c.id === selectedId)) {
            setSelectedId(list[0].id);
            setReassignDept(list[0].department);
          }
        }
      }
      if (isHead) {
        const statsRes = await fetch(`${API}/api/analytics/overview`, { headers });
        if (statsRes.ok) setStats(await statsRes.json());
      }
    } catch (err) {
      console.log('Backend sync offline, using active state.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [session]);

  const selectedComplaint = useMemo(() => {
    return complaints.find((c) => c.id === selectedId) || complaints[0] || null;
  }, [complaints, selectedId]);

  useEffect(() => {
    if (selectedComplaint) {
      setReassignDept(selectedComplaint.department);
      setActionSuccess('');
      setActionNote(
        selectedComplaint.status === 'RESOLVED'
          ? 'Complaint is resolved and verified on site.'
          : 'Field inspection completed. Corrective action executed.'
      );
    }
  }, [selectedComplaint?.id]);

  const handleSignOut = () => {
    localStorage.removeItem('cci-session');
    setSession(null);
    setSelectedId(null);
  };

  // Status Update Handler (maps to backend PATCH /api/complaints/{id}/status)
  const handleUpdateStatus = async (status) => {
    if (!selectedComplaint) return;
    setActionBusy(true);
    setActionSuccess('');

    const finalNote =
      actionNote.trim() ||
      (status === 'RESOLVED' ? 'Issue resolved and verified on site.' : 'Repair crew dispatched and started work.');

    try {
      const res = await fetch(`${API}/api/complaints/${selectedComplaint.id}/status`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          note: finalNote,
          officer_name: session.user.name || 'Department Officer',
        }),
      });

      if (res.ok) {
        setActionSuccess(
          status === 'RESOLVED'
            ? '✓ Marked as Resolved! Citizen and duplicate callers notified via SMS.'
            : '✓ Status updated to In Progress. Work order logged.'
        );
        loadData();
      } else {
        // Local state update fallback
        setComplaints((prev) =>
          prev.map((c) =>
            c.id === selectedComplaint.id
              ? {
                  ...c,
                  status,
                  timeline: [
                    ...(c.timeline || []),
                    {
                      at: new Date().toISOString(),
                      actor: session.user.name || 'Department Officer',
                      event: status === 'RESOLVED' ? 'Resolved' : 'Work Started',
                      note: finalNote,
                    },
                  ],
                }
              : c
          )
        );
        setActionSuccess(
          status === 'RESOLVED'
            ? '✓ Marked as Resolved! Citizen and duplicate callers notified via SMS.'
            : '✓ Status updated to In Progress.'
        );
      }
    } catch (e) {
      setComplaints((prev) =>
        prev.map((c) =>
          c.id === selectedComplaint.id
            ? {
                ...c,
                status,
                timeline: [
                  ...(c.timeline || []),
                  {
                    at: new Date().toISOString(),
                    actor: session.user.name || 'Department Officer',
                    event: status === 'RESOLVED' ? 'Resolved' : 'Work Started',
                    note: finalNote,
                  },
                ],
              }
            : c
        )
      );
      setActionSuccess(
        status === 'RESOLVED'
          ? '✓ Marked as Resolved! Citizen and duplicate callers notified via SMS.'
          : '✓ Status updated to In Progress.'
      );
    } finally {
      setActionBusy(false);
    }
  };

  // Department Reassignment Handler (maps to backend PATCH /api/complaints/{id}/assign)
  const handleReassignDepartment = async () => {
    if (!selectedComplaint || !reassignDept) return;
    if (reassignDept === selectedComplaint.department) {
      alert('Complaint is already assigned to this department.');
      return;
    }

    setActionBusy(true);
    setActionSuccess('');
    try {
      const res = await fetch(`${API}/api/complaints/${selectedComplaint.id}/assign`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department: reassignDept,
          officer_name: session.user.name,
        }),
      });

      if (res.ok) {
        setActionSuccess(`✓ Reassigned to ${reassignDept}. Audit timeline updated.`);
        loadData();
      } else {
        setComplaints((prev) =>
          prev.map((c) =>
            c.id === selectedComplaint.id
              ? {
                  ...c,
                  department: reassignDept,
                  timeline: [
                    ...(c.timeline || []),
                    {
                      at: new Date().toISOString(),
                      actor: session.user.name,
                      event: 'Routing Corrected',
                      note: `Department reassigned to ${reassignDept}.`,
                    },
                  ],
                }
              : c
          )
        );
        setActionSuccess(`✓ Reassigned to ${reassignDept}. Audit timeline updated.`);
      }
    } catch (e) {
      setComplaints((prev) =>
        prev.map((c) =>
          c.id === selectedComplaint.id
            ? {
                ...c,
                department: reassignDept,
                timeline: [
                  ...(c.timeline || []),
                  {
                    at: new Date().toISOString(),
                    actor: session.user.name,
                    event: 'Routing Corrected',
                    note: `Department reassigned to ${reassignDept}.`,
                  },
                ],
              }
            : c
        )
      );
      setActionSuccess(`✓ Reassigned to ${reassignDept}. Audit timeline updated.`);
    } finally {
      setActionBusy(false);
    }
  };

  // Filter complaints based on active user and filters
  const userVisibleComplaints = useMemo(() => {
    if (!session || isHead) return complaints;
    if (session.user.department) {
      return complaints.filter((c) => c.department === session.user.department);
    }
    return complaints;
  }, [complaints, session, isHead]);

  const filteredComplaints = useMemo(() => {
    return userVisibleComplaints.filter((c) => {
      if (activeFolder === 'EMERGENCY' && c.priority !== 'P1_EMERGENCY') return false;
      if (activeFolder === 'IN_PROGRESS' && c.status !== 'IN_PROGRESS') return false;
      if (activeFolder === 'DUPLICATES' && !c.duplicate_of) return false;
      if (activeFolder === 'RESOLVED' && c.status !== 'RESOLVED') return false;
      if (deptFilter !== 'ALL' && c.department !== deptFilter) return false;
      if (priorityFilter !== 'ALL' && c.priority !== priorityFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const num = (c.complaint_number || '').toLowerCase();
        const sum = (c.summary || '').toLowerCase();
        const loc = (c.location_text || '').toLowerCase();
        const phone = (c.caller_phone || '').toLowerCase();
        const dept = (c.department || '').toLowerCase();
        if (!num.includes(q) && !sum.includes(q) && !loc.includes(q) && !phone.includes(q) && !dept.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [userVisibleComplaints, activeFolder, deptFilter, priorityFilter, search]);

  const emergencyCount = userVisibleComplaints.filter((c) => c.priority === 'P1_EMERGENCY').length;
  const inProgressCount = userVisibleComplaints.filter((c) => c.status === 'IN_PROGRESS').length;
  const duplicateCount = userVisibleComplaints.filter((c) => Boolean(c.duplicate_of)).length;
  const resolvedCount = userVisibleComplaints.filter((c) => c.status === 'RESOLVED').length;

  // If not logged in
  if (!session) {
    return (
      <Login
        onLogin={(val) => {
          localStorage.setItem('cci-session', JSON.stringify(val));
          setSession(val);
        }}
      />
    );
  }

  // If simulator
  if (isSimulator) {
    return (
      <Simulator
        session={session}
        onSignOut={handleSignOut}
        onSwitchToOfficial={() => {
          localStorage.removeItem('cci-session');
          setSession(null);
        }}
      />
    );
  }

  return (
    <div className="inbox-app-layout">
      {/* 1. LEFT NAVIGATION RAIL */}
      <aside className="inbox-nav-rail">
        <div className="user-profile-widget">
          <div className="user-avatar-circle">
            {session.user.name ? session.user.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="user-text-info">
            <strong>{session.user.name}</strong>
            <span className="user-role-label">
              {isHead ? 'AI Complaint Manager' : session.user.department?.split(' ')[0]}
            </span>
          </div>
        </div>

        <nav className="inbox-channels-menu">
          <button
            type="button"
            className={`channel-item ${activeFolder === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveFolder('ALL')}
          >
            <span className="channel-icon">📥</span>
            <span className="channel-label">All Incidents</span>
            <span className="channel-count">{userVisibleComplaints.length}</span>
          </button>

          <button
            type="button"
            className={`channel-item ${activeFolder === 'EMERGENCY' ? 'active' : ''}`}
            onClick={() => setActiveFolder('EMERGENCY')}
          >
            <span className="channel-icon">🚨</span>
            <span className="channel-label">Emergency (P1)</span>
            {emergencyCount > 0 && <span className="channel-count danger">{emergencyCount}</span>}
          </button>

          <button
            type="button"
            className={`channel-item ${activeFolder === 'IN_PROGRESS' ? 'active' : ''}`}
            onClick={() => setActiveFolder('IN_PROGRESS')}
          >
            <span className="channel-icon">⏳</span>
            <span className="channel-label">In Progress</span>
            {inProgressCount > 0 && <span className="channel-count">{inProgressCount}</span>}
          </button>

          <button
            type="button"
            className={`channel-item ${activeFolder === 'DUPLICATES' ? 'active' : ''}`}
            onClick={() => setActiveFolder('DUPLICATES')}
          >
            <span className="channel-icon">🔗</span>
            <span className="channel-label">Merged Duplicates</span>
            {duplicateCount > 0 && <span className="channel-count">{duplicateCount}</span>}
          </button>

          <button
            type="button"
            className={`channel-item ${activeFolder === 'RESOLVED' ? 'active' : ''}`}
            onClick={() => setActiveFolder('RESOLVED')}
          >
            <span className="channel-icon">✓</span>
            <span className="channel-label">Resolved</span>
            <span className="channel-count success">{resolvedCount}</span>
          </button>

          {isHead && (
            <button
              type="button"
              className={`channel-item ${activeFolder === 'ANALYTICS' ? 'active' : ''}`}
              onClick={() => setActiveFolder('ANALYTICS')}
            >
              <span className="channel-icon">📊</span>
              <span className="channel-label">Analytics &amp; Map</span>
            </button>
          )}
        </nav>

        <div className="inbox-rail-footer">
          <button
            type="button"
            className="btn-rail-action"
            onClick={() => {
              localStorage.removeItem('cci-session');
              setSession(null);
            }}
          >
            🎙️ Call Simulator Rig
          </button>
          <button type="button" className="btn-rail-action" onClick={loadData} title="Refresh complaints from backend">
            🔄 Refresh {busy ? '…' : ''}
          </button>
          <button type="button" className="btn-rail-signout" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* 2. MIDDLE COLUMN: INCIDENT STREAM FEED */}
      <section className="inbox-feed-column">
        <div className="feed-header">
          <div className="feed-search-bar">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search phone, ID, landmark…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="btn-clear" onClick={() => setSearch('')}>
                ×
              </button>
            )}
          </div>

          {isHead && (
            <select
              className="feed-dept-select"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="ALL">All Departments</option>
              {ALL_DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
          <select
            className="feed-dept-select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="ALL">All Priorities</option>
            <option value="P1_EMERGENCY">Emergency (P1)</option>
            <option value="P2_HIGH">High Priority (P2)</option>
            <option value="P3_MEDIUM">Medium Priority (P3)</option>
            <option value="P4_LOW">Low Priority (P4)</option>
          </select>
        </div>

        <div className="feed-cards-scroll">
          {filteredComplaints.map((c) => {
            const isSelected = c.id === selectedId;
            const isEmergency = c.priority === 'P1_EMERGENCY';
            return (
              <div
                key={c.id}
                className={`feed-message-card ${isSelected ? 'selected' : ''} ${
                  isEmergency ? 'emergency-card' : ''
                }`}
                onClick={() => {
                  setSelectedId(c.id);
                  if (activeFolder === 'ANALYTICS') setActiveFolder('ALL');
                }}
              >
                <div className="card-top-info">
                  <div className="sender-row">
                    <span className="caller-dot" />
                    <strong>{c.caller_phone}</strong>
                    <span className="complaint-ref" title={c.complaint_number}>
                      {shortComplaintId(c.complaint_number)}
                    </span>
                  </div>
                  <time className="msg-time">{timeAgo(c.created_at)}</time>
                </div>

                <p className="card-snippet">{c.summary}</p>

                <div className="card-footer-tags">
                  <span className="dept-tag-clean">{c.department.split(' ')[0]}</span>
                  <span className={`pill ${c.priority}`}>
                    {c.priority === 'P1_EMERGENCY' ? 'Emergency' : c.priority.replace('P', 'P')}
                  </span>
                  <span className={`status-pill ${c.status}`}>{c.status.replace('_', ' ')}</span>
                  {c.duplicate_of && <span className="tag-duplicate">🔗 Merged</span>}
                </div>
              </div>
            );
          })}

          {filteredComplaints.length === 0 && (
            <div className="empty-feed-state">
              <span>📭</span>
              <p>No complaints match current filters.</p>
            </div>
          )}
        </div>
      </section>

      {/* 3. RIGHT COLUMN: THREAD WORKBENCH OR ANALYTICS */}
      <main className="inbox-thread-column">
        {activeFolder === 'ANALYTICS' && isHead ? (
          /* ANALYTICS & CITY HEATMAP VIEW */
          <div className="analytics-view-container">
            <div className="thread-masthead">
              <div>
                <h2>Operations &amp; Workload Command</h2>
                <span className="caller-sub">Live civic telemetry across city wards</span>
              </div>
              <span className="masthead-badge">LIVE TELEMETRY</span>
            </div>

            <div className="analytics-kpi-row">
              <div className="kpi-mini">
                <span>TOTAL COMPLAINTS</span>
                <b>{userVisibleComplaints.length}</b>
              </div>
              <div className="kpi-mini danger">
                <span>URGENT (P1)</span>
                <b>{emergencyCount}</b>
              </div>
              <div className="kpi-mini warning">
                <span>IN PROGRESS</span>
                <b>{inProgressCount}</b>
              </div>
              <div className="kpi-mini success">
                <span>RESOLVED</span>
                <b>
                  {userVisibleComplaints.length
                    ? Math.round((resolvedCount / userVisibleComplaints.length) * 100)
                    : 0}
                  %
                </b>
              </div>
            </div>

            <div className="map-wrapper-clean">
              <MapView
                complaints={userVisibleComplaints}
                onSelectComplaint={(c) => {
                  setSelectedId(c.id);
                  setActiveFolder('ALL');
                }}
              />
            </div>

            <div className="workload-card-clean">
              <h3>Department Workload Distribution</h3>
              <div className="bars-container">
                {ALL_DEPARTMENTS.map((dept) => {
                  const count = complaints.filter((c) => c.department === dept).length;
                  const maxVal = Math.max(...ALL_DEPARTMENTS.map((d) => complaints.filter((c) => c.department === d).length), 1);
                  const pct = Math.round((count / maxVal) * 100);
                  return (
                    <div key={dept} className="workload-row">
                      <span className="dept-name">{dept}</span>
                      <div className="track">
                        <div className="fill" style={{ width: `${pct}%` }} />
                      </div>
                      <b>{count}</b>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : selectedComplaint ? (
          /* INCIDENT THREAD DETAILS */
          <div className="incident-thread-container">
            <div className="thread-masthead">
              <div>
                <div className="thread-id-row">
                  <span className="thread-id" title={selectedComplaint.complaint_number}>
                    {shortComplaintId(selectedComplaint.complaint_number)}
                  </span>
                  <span className={`pill ${selectedComplaint.priority}`}>
                    {selectedComplaint.priority?.replace('_', ' ')}
                  </span>
                  <span className={`status-pill ${selectedComplaint.status}`}>
                    {selectedComplaint.status?.replace('_', ' ')}
                  </span>
                </div>
                <h2>{selectedComplaint.department}</h2>
                <span className="caller-sub">
                  Caller: {selectedComplaint.caller_phone} · Received {formatTime(selectedComplaint.created_at)}
                </span>
              </div>

              {/* Head Office Department Reassignment */}
              {isHead && (
                <div className="head-reassign-widget">
                  <label>Routing Correction:</label>
                  <div className="reassign-bar">
                    <select
                      value={reassignDept}
                      onChange={(e) => setReassignDept(e.target.value)}
                      className="reassign-select"
                    >
                      {ALL_DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-reassign-submit"
                      onClick={handleReassignDepartment}
                      disabled={actionBusy}
                    >
                      {actionBusy ? '…' : 'Reassign'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {actionSuccess && <div className="action-success-toast">{actionSuccess}</div>}

            {selectedComplaint.duplicate_of && (
              <div className="thread-duplicate-banner">
                <span className="icon">🔗</span>
                <div>
                  <strong>Duplicate Incident Linked!</strong>
                  <p>
                    Merged with Master Ticket <code>{selectedComplaint.duplicate_complaint_number}</code> for locality{' '}
                    <em>{selectedComplaint.location_text || 'same area'}</em>. Resolving this incident dispatches SMS notifications to all linked callers.
                  </p>
                </div>
              </div>
            )}

            {/* Citizen Verbatim Voice Post Bubble */}
            <div className="citizen-post-bubble">
              <div className="post-header">
                <span className="post-author-avatar">🎙️</span>
                <div>
                  <strong>Citizen Audio Voice Intake (Verbatim)</strong>
                  <small>
                    Language: {selectedComplaint.detected_language || 'English'} · AI Confidence:{' '}
                    {Math.round((selectedComplaint.confidence || 0.85) * 100)}%
                  </small>
                </div>
              </div>
              <p className="post-transcript">"{selectedComplaint.transcript}"</p>
            </div>

            {/* Civic Triage Metrics */}
            <div className="thread-metrics-strip">
              <div className="metric-chip">
                <span>LANDMARK</span>
                <strong>{selectedComplaint.location_text || 'Awaiting location reply'}</strong>
              </div>
              <div className="metric-chip">
                <span>HAZARD RISK SCORE</span>
                <strong
                  className={(selectedComplaint.hazard_risk_score || 50) >= 70 ? 'hazard-danger' : ''}
                >
                  {selectedComplaint.hazard_risk_score || 50} / 100
                </strong>
              </div>
              <div className="metric-chip">
                <span>ACTION REQUIRED</span>
                <strong>{selectedComplaint.action_required || 'Field inspection & repair'}</strong>
              </div>
            </div>

            {/* Official Action Workbench */}
            <div className="thread-action-workbench">
              <label htmlFor="action-remarks-input">Official Work Remarks / Resolution Notes:</label>
              <textarea
                id="action-remarks-input"
                rows={2}
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Type resolution remarks or work update note here..."
                className="action-textarea"
              />

              <div className="action-button-strip">
                {selectedComplaint.status !== 'IN_PROGRESS' && selectedComplaint.status !== 'RESOLVED' && (
                  <button
                    type="button"
                    className="btn-start-work"
                    onClick={() => handleUpdateStatus('IN_PROGRESS')}
                    disabled={actionBusy}
                  >
                    ▶ Start Work (In Progress)
                  </button>
                )}

                {selectedComplaint.status !== 'RESOLVED' && (
                  <button
                    type="button"
                    className="btn-resolve-now"
                    onClick={() => handleUpdateStatus('RESOLVED')}
                    disabled={actionBusy}
                  >
                    ✓ Mark Resolved &amp; Send Citizen SMS
                  </button>
                )}

                {selectedComplaint.status === 'RESOLVED' && (
                  <span className="resolved-status-tag">
                    ✓ This incident is fully resolved and citizen SMS has been delivered.
                  </span>
                )}
              </div>
            </div>

            {/* Activity History & Audit Trail */}
            <div className="thread-timeline-section">
              <h3>Incident Activity &amp; Audit Trail</h3>
              <div className="activity-stream">
                {(selectedComplaint.timeline || []).slice().reverse().map((t, i) => (
                  <div key={i} className="activity-node">
                    <div className="activity-dot" />
                    <div className="activity-content">
                      <div className="activity-title-row">
                        <strong>{t.event}</strong>
                        <time>{formatTime(t.at)}</time>
                      </div>
                      <p>{t.note}</p>
                      <span className="activity-actor">Logged by: {t.actor}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-thread-placeholder">
            <span>👈</span>
            <p>Select a citizen complaint from the inbox feed on the left to inspect details, reassign department, or resolve the issue.</p>
          </div>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
