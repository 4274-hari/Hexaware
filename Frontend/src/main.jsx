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

const shortComplaintId = (value) => value ? `CIV-${value.replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase()}` : 'CIV-NEW';
const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cci-session') || 'null');
    } catch {
      return null;
    }
  });

  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
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
        setComplaints(list);
        if (!selectedId && list.length > 0) {
          setSelectedId(list[0].id);
          setReassignDept(list[0].department);
        }
      }
      if (isHead) {
        const statsRes = await fetch(`${API}/api/analytics/overview`, { headers });
        if (statsRes.ok) setStats(await statsRes.json());
      }
    } catch (err) {
      console.error('Error loading complaints:', err);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [session]);

  const selectedComplaint = useMemo(() => {
    return complaints.find((c) => c.id === selectedId) || null;
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

  // Inline Status Update (Start Work / Resolve)
  const handleUpdateStatus = async (status) => {
    if (!selectedComplaint) return;
    setActionBusy(true);
    setActionSuccess('');

    const finalNote = actionNote.trim() || (status === 'RESOLVED' ? 'Issue resolved and verified on site.' : 'Repair crew started work.');

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
            : '✓ Status updated to In Progress.'
        );
        const updatedRes = await fetch(`${API}/api/complaints/${selectedComplaint.id}`, { headers });
        if (updatedRes.ok) {
          const updatedDoc = await updatedRes.json();
          setComplaints((prev) => prev.map((c) => (c.id === updatedDoc.id ? updatedDoc : c)));
        }
        loadData();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.detail || 'Unable to update status.');
      }
    } catch (e) {
      alert('Network error while updating status.');
    } finally {
      setActionBusy(false);
    }
  };

  // Direct Head Office Department Reassignment
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
        const updatedRes = await fetch(`${API}/api/complaints/${selectedComplaint.id}`, { headers });
        if (updatedRes.ok) {
          const updatedDoc = await updatedRes.json();
          setComplaints((prev) => prev.map((c) => (c.id === updatedDoc.id ? updatedDoc : c)));
        }
        loadData();
      } else {
        alert('Department reassignment failed.');
      }
    } catch (e) {
      alert('Error updating department.');
    } finally {
      setActionBusy(false);
    }
  };

  // Filter complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
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
  }, [complaints, activeFolder, deptFilter, priorityFilter, search]);

  const emergencyCount = complaints.filter((c) => c.priority === 'P1_EMERGENCY').length;
  const inProgressCount = complaints.filter((c) => c.status === 'IN_PROGRESS').length;
  const duplicateCount = complaints.filter((c) => Boolean(c.duplicate_of)).length;
  const resolvedCount = complaints.filter((c) => c.status === 'RESOLVED').length;

  const downloadReport = () => {
    const header = ['Reference', 'Original ID', 'Status', 'Priority', 'Department', 'Caller mobile', 'Location', 'Summary', 'Created at', 'Assigned officer'];
    const rows = filteredComplaints.map((c) => [shortComplaintId(c.complaint_number), c.complaint_number, c.status, c.priority, c.department, c.caller_phone, c.location_text, c.summary, c.created_at, c.assigned_officer]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const file = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(file); const link = document.createElement('a');
    link.href = url; link.download = 'civic-complaints-report.csv'; link.click(); URL.revokeObjectURL(url);
  };

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
      {/* 1. LEFT NAVIGATION RAIL (Corporate Social / Channel Rail) */}
      <aside className="inbox-nav-rail">
        <div className="user-profile-widget">
          <div className="user-avatar-circle">
            {session.user.name ? session.user.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="user-text-info">
            <strong>{session.user.name}</strong>
            <span className="user-role-label">
              {isHead ? 'District Head Office' : session.user.department?.split(' ')[0]}
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
            <span className="channel-count">{complaints.length}</span>
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
            🎙️ Call Simulator
          </button>
          <button type="button" className="btn-rail-action" onClick={loadData} title="Refresh complaints">
            🔄 Sync {busy ? '…' : ''}
          </button>
          <button type="button" className="btn-rail-action" onClick={downloadReport}>Export Excel report</button>
          <button type="button" className="btn-rail-signout" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* 2. MIDDLE COLUMN: THE MESSAGE STREAM / INBOX FEED */}
      <section className="inbox-feed-column">
        <div className="feed-header">
          <div className="feed-search-bar">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search citizen messages…"
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
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
          <select className="feed-dept-select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="ALL">All priorities</option>
            <option value="P1_EMERGENCY">Emergency</option>
            <option value="P2_HIGH">High</option>
            <option value="P3_MEDIUM">Medium</option>
            <option value="P4_LOW">Low</option>
          </select>
        </div>

        <div className="feed-cards-scroll">
          {filteredComplaints.map((c) => {
            const isSelected = c.id === selectedId;
            const isEmergency = c.priority === 'P1_EMERGENCY';
            return (
              <div
                key={c.id}
                className={`feed-message-card ${isSelected ? 'selected' : ''} ${isEmergency ? 'emergency-card' : ''}`}
                onClick={() => {
                  setSelectedId(c.id);
                  if (activeFolder === 'ANALYTICS') setActiveFolder('ALL');
                }}
              >
                <div className="card-top-info">
                  <div className="sender-row">
                    <span className="caller-dot" />
                    <strong>{c.caller_phone}</strong>
                    <span className="complaint-ref" title={c.complaint_number}>{shortComplaintId(c.complaint_number)}</span>
                  </div>
                  <time className="msg-time">{timeAgo(c.created_at)}</time>
                </div>

                <p className="card-snippet">{c.summary}</p>

                <div className="card-footer-tags">
                  <span className="dept-tag-clean">{c.department.split(' ')[0]}</span>
                  <span className={`pill ${c.priority}`}>{c.priority === 'P1_EMERGENCY' ? 'Emergency' : c.priority.replace('P', 'P')}</span>
                  <span className={`status-pill ${c.status}`}>{c.status.replace('_', ' ')}</span>
                  {c.duplicate_of && <span className="tag-duplicate">🔗 Merged</span>}
                </div>
              </div>
            );
          })}

          {filteredComplaints.length === 0 && (
            <div className="empty-feed-state">
              <span>📭</span>
              <p>No complaints found in this channel.</p>
            </div>
          )}
        </div>
      </section>

      {/* 3. RIGHT COLUMN: THREAD DETAILS OR ANALYTICS */}
      <main className="inbox-thread-column">
        {activeFolder === 'ANALYTICS' && isHead ? (
          /* ANALYTICS & HEATMAP VIEW */
          <div className="analytics-view-container">
            <div className="thread-masthead">
              <h2>Operations overview</h2>
              <span className="masthead-badge">LIVE WORKLOAD</span>
            </div>

            <div className="analytics-kpi-row">
              <div className="kpi-mini">
                <span>ALL COMPLAINTS</span>
                <b>{complaints.length}</b>
              </div>
              <div className="kpi-mini danger">
                <span>NEEDS URGENT ACTION</span>
                <b>{emergencyCount}</b>
              </div>
              <div className="kpi-mini warning">
                <span>WORK IN PROGRESS</span>
                <b>{inProgressCount}</b>
              </div>
              <div className="kpi-mini success">
                <span>COMPLETED</span>
                <b>{complaints.length ? Math.round((resolvedCount / complaints.length) * 100) : 0}%</b>
              </div>
            </div>

            <div className="map-wrapper-clean">
              <MapView
                complaints={complaints}
                onSelectComplaint={(c) => {
                  setSelectedId(c.id);
                  setActiveFolder('ALL');
                }}
              />
            </div>

            {stats && (
              <div className="workload-card-clean">
              <h3>Open workload by department</h3>
                <div className="bars-container">
                  {stats.by_department.map((d) => {
                    const maxVal = Math.max(...stats.by_department.map((x) => x.count), 1);
                    const pct = Math.round((d.count / maxVal) * 100);
                    return (
                      <div key={d._id} className="workload-row">
                        <span className="dept-name">{d._id}</span>
                        <div className="track"><div className="fill" style={{ width: `${pct}%` }} /></div>
                        <b>{d.count}</b>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : selectedComplaint ? (
          /* INCIDENT THREAD DETAILS */
          <div className="incident-thread-container">
            <div className="thread-masthead">
              <div>
                <div className="thread-id-row">
                  <span className="thread-id" title={selectedComplaint.complaint_number}>{shortComplaintId(selectedComplaint.complaint_number)}</span>
                  <span className={`pill ${selectedComplaint.priority}`}>{selectedComplaint.priority?.replace('_', ' ')}</span>
                  <span className={`status-pill ${selectedComplaint.status}`}>{selectedComplaint.status?.replace('_', ' ')}</span>
                </div>
                <h2>{selectedComplaint.department}</h2>
                <span className="caller-sub">From: {selectedComplaint.caller_phone} · Received {formatTime(selectedComplaint.created_at)}</span>
              </div>

              {/* ⭐️ HEAD OFFICE DIRECT DEPARTMENT REASSIGNMENT DROPDOWN */}
              {isHead && (
                <div className="head-reassign-widget">
                  <label>Department Routing Correction:</label>
                  <div className="reassign-bar">
                    <select
                      value={reassignDept}
                      onChange={(e) => setReassignDept(e.target.value)}
                      className="reassign-select"
                    >
                      {ALL_DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-reassign-submit"
                      onClick={handleReassignDepartment}
                      disabled={actionBusy}
                    >
                      {actionBusy ? '…' : 'Change'}
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
                    Merged with Master Ticket <code>{selectedComplaint.duplicate_complaint_number}</code> for location <em>{selectedComplaint.location_text || 'same area'}</em>. Resolving this master incident notifies all callers via SMS.
                  </p>
                </div>
              </div>
            )}

            {/* Citizen Voice Post Bubble */}
            <div className="citizen-post-bubble">
              <div className="post-header">
                <span className="post-author-avatar">🎙️</span>
                <div>
                  <strong>Citizen Audio Voice Intake (Verbatim)</strong>
                  <small>Language: {selectedComplaint.detected_language || 'English'} · AI Confidence: {Math.round((selectedComplaint.confidence || 0.85) * 100)}%</small>
                </div>
              </div>
              <p className="post-transcript">"{selectedComplaint.transcript}"</p>
            </div>

            {/* Triage Metrics Strip */}
            <div className="thread-metrics-strip">
              <div className="metric-chip">
                <span>LANDMARK</span>
                <strong>{selectedComplaint.location_text || 'Awaiting location reply'}</strong>
              </div>
              <div className="metric-chip">
                <span>HAZARD RISK</span>
                <strong className={(selectedComplaint.hazard_risk_score || 50) >= 70 ? 'hazard-danger' : ''}>
                  {selectedComplaint.hazard_risk_score || 50} / 100
                </strong>
              </div>
              <div className="metric-chip">
                <span>ACTION REQUIRED</span>
                <strong>{selectedComplaint.action_required || 'Field inspection & repair'}</strong>
              </div>
            </div>

            {/* Official Action Workbench (Inline Resolution Bar) */}
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
                  <span className="resolved-status-tag">✓ This incident is fully resolved and citizen SMS has been delivered.</span>
                )}
              </div>
            </div>

            {/* Activity History */}
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
                      <span className="activity-actor">Updated by: {t.actor}</span>
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
