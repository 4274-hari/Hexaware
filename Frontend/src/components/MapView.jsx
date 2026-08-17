import React, { useState } from 'react';

const SECTOR_COORDINATES = {
  'gandhi circle': { x: 50, y: 48, label: 'Gandhi Circle' },
  'anna nagar': { x: 26, y: 28, label: 'Anna Nagar' },
  't nagar': { x: 42, y: 68, label: 'T. Nagar' },
  'mg road': { x: 74, y: 72, label: 'MG Road' },
  'market street': { x: 76, y: 38, label: 'Market Street' },
  'ring road': { x: 22, y: 74, label: 'Ring Road' },
  'central station': { x: 58, y: 36, label: 'Central Station' },
  'bus stand': { x: 18, y: 42, label: 'Bus Terminus' },
  'nehru park': { x: 38, y: 44, label: 'Nehru Park' },
  'guindy': { x: 28, y: 88, label: 'Guindy Industrial' },
  'velachery': { x: 62, y: 88, label: 'Velachery South' },
  'mylapore': { x: 68, y: 58, label: 'Mylapore Ward' },
};

const DEPT_COLORS = {
  'Water Supply & Sewerage Board': '#0284c7',
  'Electricity & Power Distribution': '#d97706',
  'Municipal Corporation & Sanitation': '#16a34a',
  'Public Works (PWD) & Roads': '#4f46e5',
  'Traffic & Urban Mobility': '#ea580c',
  'Disaster Management': '#dc2626',
};

export default function MapView({ complaints, onSelectComplaint }) {
  const [selectedPin, setSelectedPin] = useState(null);
  const [filterDept, setFilterDept] = useState('ALL');
  const [viewMode, setViewMode] = useState('PINS'); // 'PINS' or 'HEATMAP'

  // Map complaints to coordinates
  const mappedIncidents = complaints.map((c) => {
    const locLower = (c.location_text || '').toLowerCase();
    let pos = null;

    for (const [key, val] of Object.entries(SECTOR_COORDINATES)) {
      if (locLower.includes(key)) {
        pos = { ...val };
        break;
      }
    }

    if (!pos) {
      // Deterministic coordinate based on ID
      const charCode = (c.id || '').charCodeAt(0) || 65;
      const x = 30 + ((charCode * 17) % 45);
      const y = 30 + ((charCode * 23) % 45);
      pos = { x, y, label: c.location_text || 'Reported Locality' };
    }

    return {
      ...c,
      pos,
      color: DEPT_COLORS[c.department] || '#475569',
    };
  });

  const filteredIncidents = mappedIncidents.filter((inc) => {
    if (filterDept !== 'ALL' && inc.department !== filterDept) return false;
    return true;
  });

  return (
    <div className="map-view-container">
      {/* Map Control Bar */}
      <div className="map-controls">
        <div className="map-legend-items">
          <span className="legend-title">Filter by Department:</span>
          {Object.entries(DEPT_COLORS).map(([dept, color]) => (
            <button
              key={dept}
              type="button"
              className={`legend-pill ${filterDept === dept ? 'active' : ''}`}
              onClick={() => setFilterDept(filterDept === dept ? 'ALL' : dept)}
              style={{
                borderColor: color,
                backgroundColor: filterDept === dept ? color : 'transparent',
                color: filterDept === dept ? '#ffffff' : '#1e293b',
              }}
            >
              <span className="legend-dot" style={{ backgroundColor: filterDept === dept ? '#ffffff' : color }} />
              {dept.split(' ')[0]}
            </button>
          ))}
        </div>

        <div className="map-view-toggle">
          <button
            type="button"
            className={viewMode === 'PINS' ? 'active' : ''}
            onClick={() => setViewMode('PINS')}
          >
            Incident Pins ({filteredIncidents.length})
          </button>
          <button
            type="button"
            className={viewMode === 'HEATMAP' ? 'active' : ''}
            onClick={() => setViewMode('HEATMAP')}
          >
            Hazard Heatmap
          </button>
        </div>
      </div>

      {/* SVG Interactive City Map Canvas */}
      <div className="map-canvas-wrapper">
        <svg viewBox="0 0 100 100" className="city-svg-map">
          {/* Base Background & Grid */}
          <rect x="0" y="0" width="100" height="100" fill="#f8fafc" />
          
          {/* Water body */}
          <path
            d="M 85 0 C 82 25, 92 60, 88 100 L 100 100 L 100 0 Z"
            fill="#e0f2fe"
            stroke="#bae6fd"
            strokeWidth="0.5"
          />
          <text x="94" y="50" fill="#0284c7" fontSize="2.5" transform="rotate(90, 94, 50)" textAnchor="middle" opacity="0.7" fontWeight="600">
            Bay Coastline
          </text>

          {/* Major arterial roads */}
          <line x1="0" y1="50" x2="88" y2="50" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="1,1" />
          <line x1="50" y1="0" x2="50" y2="100" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="1,1" />
          <line x1="20" y1="10" x2="80" y2="90" stroke="#e2e8f0" strokeWidth="2" />
          <line x1="10" y1="80" x2="85" y2="20" stroke="#e2e8f0" strokeWidth="2" />

          {/* Sector Landmark Labels */}
          {Object.entries(SECTOR_COORDINATES).map(([key, sector]) => (
            <g key={key} transform={`translate(${sector.x}, ${sector.y})`}>
              <circle cx="0" cy="0" r="1.2" fill="#94a3b8" opacity="0.5" />
              <text
                x="0"
                y="-2.5"
                textAnchor="middle"
                fontSize="2.2"
                fontWeight="700"
                fill="#475569"
                className="sector-label"
              >
                {sector.label}
              </text>
            </g>
          ))}

          {/* Heatmap Layer if Active */}
          {viewMode === 'HEATMAP' &&
            filteredIncidents.map((inc) => (
              <circle
                key={`heat-${inc.id}`}
                cx={inc.pos.x}
                cy={inc.pos.y}
                r={inc.priority === 'P1_EMERGENCY' ? '12' : '8'}
                fill={inc.priority === 'P1_EMERGENCY' ? '#ef4444' : '#f59e0b'}
                opacity="0.28"
                className="heatmap-glow"
              />
            ))}

          {/* Incident Pins */}
          {filteredIncidents.map((inc) => {
            const isEmergency = inc.priority === 'P1_EMERGENCY';
            const isSelected = selectedPin?.id === inc.id;

            return (
              <g
                key={inc.id}
                transform={`translate(${inc.pos.x}, ${inc.pos.y})`}
                className="incident-pin-group"
                onClick={() => setSelectedPin(inc)}
                style={{ cursor: 'pointer' }}
              >
                {/* Emergency Pulse Ring */}
                {isEmergency && (
                  <circle
                    cx="0"
                    cy="0"
                    r="5"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="0.8"
                    className="pin-pulse"
                  />
                )}

                {/* Main Pin Circle */}
                <circle
                  cx="0"
                  cy="0"
                  r={isSelected ? '3.5' : isEmergency ? '3' : '2.2'}
                  fill={inc.color}
                  stroke="#ffffff"
                  strokeWidth="0.8"
                />

                {/* Priority Icon */}
                {isEmergency && (
                  <text x="0" y="0.8" textAnchor="middle" fontSize="1.8" fill="#ffffff" fontWeight="bold">
                    !
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Selected Incident Floating Detail Popover */}
        {selectedPin && (
          <div className="map-pin-popover">
            <div className="popover-header">
              <span className="popover-id">#{selectedPin.complaint_number}</span>
              <span className={`pill ${selectedPin.priority}`}>{selectedPin.priority?.replace('_', ' ')}</span>
              <button
                type="button"
                className="popover-close"
                onClick={() => setSelectedPin(null)}
                aria-label="Close Popover"
              >
                ×
              </button>
            </div>
            <h4 className="popover-summary">{selectedPin.summary}</h4>
            <div className="popover-meta">
              <span><strong>Department:</strong> {selectedPin.department}</span>
              <span><strong>Landmark:</strong> {selectedPin.location_text || 'Awaiting location reply'}</span>
              <span><strong>Hazard Risk:</strong> {selectedPin.hazard_risk_score || 50}/100</span>
              <span><strong>Status:</strong> {selectedPin.status?.replace('_', ' ')}</span>
            </div>
            <div className="popover-actions">
              <button
                type="button"
                className="btn-popover-inspect"
                onClick={() => {
                  onSelectComplaint(selectedPin);
                  setSelectedPin(null);
                }}
              >
                Open Full Incident Record →
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="map-footer-hint">
        <span>💡 Click any incident pin on the map to inspect summary and open full record.</span>
        <span>Showing {filteredIncidents.length} complaints</span>
      </div>
    </div>
  );
}
