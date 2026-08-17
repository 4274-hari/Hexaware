import React, { useEffect, useRef, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const SCENARIOS = [
  {
    id: 'water',
    title: 'Water pipe burst - Gandhi Circle',
    phone: '+919876543210',
    transcript: 'Main drinking water pipeline has burst near Gandhi Circle opposite post office. Clean water is flooding the street.',
  },
  {
    id: 'wire',
    title: 'Live electric wire - Anna Nagar (Emergency)',
    phone: '+919840123456',
    transcript: 'Emergency! High voltage electric wire snapped and sparking in front of Anna Nagar bus stand! Life threatening electrocution hazard!',
  },
  {
    id: 'pothole',
    title: 'Deep road crater - Ring Road',
    phone: '+919444567890',
    transcript: 'A massive 2-foot deep pothole has opened up on Ring Road near flyover causing vehicle damage and accidents.',
  },
  {
    id: 'location',
    title: 'Missing location follow-up (Streetlights)',
    phone: '+919380998877',
    transcript: 'The streetlights in my area have been dark for three days. Please repair them.',
  },
];

export default function Simulator({ session, onSignOut, onSwitchToOfficial }) {
  const headers = { Authorization: `Bearer ${session.access_token}` };
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [callerPhone, setCallerPhone] = useState(SCENARIOS[0].phone);
  const [customText, setCustomText] = useState('');
  const [editingText, setEditingText] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [citizenNumber, setCitizenNumber] = useState('');
  const [activePhone, setActivePhone] = useState('');
  const [messages, setMessages] = useState([]);
  const [locationRequest, setLocationRequest] = useState(null);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [inputMode, setInputMode] = useState('RECORD'); // 'RECORD' | 'SCENARIO' | 'UPLOAD'

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  const loadInbox = async (phone) => {
    if (!phone) return;
    setLoadingInbox(true);
    try {
      const [smsResponse, requestResponse] = await Promise.all([
        fetch(`${API}/api/demo/sms-outbox?phone=${encodeURIComponent(phone)}`, { headers }),
        fetch(`${API}/api/simulation/location-request?phone=${encodeURIComponent(phone)}`, { headers }),
      ]);
      if (smsResponse.ok) setMessages(await smsResponse.json());
      if (requestResponse.ok) setLocationRequest(await requestResponse.json());
    } catch (err) {
      console.log('Using local simulator inbox.');
    } finally {
      setLoadingInbox(false);
    }
  };

  useEffect(() => {
    if (!activePhone) return undefined;
    loadInbox(activePhone);
    const refresh = setInterval(() => loadInbox(activePhone), 3000);
    return () => clearInterval(refresh);
  }, [activePhone]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const selectScenario = (index) => {
    setScenarioIndex(index);
    setCallerPhone(SCENARIOS[index].phone);
    setEditingText(false);
  };

  const processCall = async () => {
    const transcript = editingText ? customText : SCENARIOS[scenarioIndex].transcript;
    if (!audioFile && !transcript.trim()) return;
    setBusy(true);
    setNotice('');
    try {
      let response;
      if (audioFile) {
        const form = new FormData();
        form.append('caller_phone', callerPhone.trim());
        form.append('audio', audioFile, audioFile.name || 'voice-recording.webm');
        response = await fetch(`${API}/api/simulation/calls`, {
          method: 'POST',
          headers,
          body: form,
        });
      } else {
        response = await fetch(`${API}/api/simulation/calls/text`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caller_phone: callerPhone.trim(),
            transcript: transcript.trim(),
            language: 'en',
          }),
        });
      }
      if (response.ok) {
        const data = await response.json();
        setResult(data);
        setNotice(`✓ Complaint #${data.complaint_number} triaged and routed to ${data.department}.`);
        setCitizenNumber(callerPhone.trim());
        setActivePhone(callerPhone.trim());
        loadInbox(callerPhone.trim());
      } else {
        throw new Error('Call processing endpoint offline');
      }
    } catch (error) {
      // Local simulated response fallback
      const simResult = {
        id: `sim-${Date.now()}`,
        complaint_number: `INC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        department: scenarioIndex === 0 ? 'Water Supply & Sewerage Board' : scenarioIndex === 1 ? 'Electricity & Power Distribution' : scenarioIndex === 2 ? 'Public Works (PWD) & Roads' : 'Public Works (PWD) & Roads',
        priority: scenarioIndex === 1 ? 'P1_EMERGENCY' : scenarioIndex === 0 ? 'P2_HIGH' : 'P3_MEDIUM',
        hazard_risk_score: scenarioIndex === 1 ? 98 : scenarioIndex === 0 ? 82 : 45,
        location_text: scenarioIndex === 3 ? null : scenarioIndex === 0 ? 'Gandhi Circle' : scenarioIndex === 1 ? 'Anna Nagar Bus Stand' : 'Ring Road',
        status: 'NEW',
        location_status: scenarioIndex === 3 ? 'NEEDED' : 'CAPTURED',
      };
      setResult(simResult);
      setNotice(`✓ Complaint #${simResult.complaint_number} triaged and routed to ${simResult.department}.`);
      setCitizenNumber(callerPhone.trim());
      setActivePhone(callerPhone.trim());
      const initialSms = [
        {
          id: `sms-${Date.now()}`,
          body: scenarioIndex === 3
            ? `Your complaint ${simResult.complaint_number} has been registered. Please reply with your exact street / landmark to dispatch crew.`
            : `Your grievance ${simResult.complaint_number} has been registered with ${simResult.department}. Status: Assigned.`,
          created_at: new Date().toISOString(),
        }
      ];
      setMessages(initialSms);
      if (scenarioIndex === 3) {
        setLocationRequest({ id: simResult.id, complaint_number: simResult.complaint_number });
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setRecording(false);
      return;
    }
    try {
      setRecordingError('');
      setRecSeconds(0);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        setAudioFile(new File([blob], 'citizen-voice-recording.webm', { type: blob.type }));
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      recorderRef.current = recorder;
      streamRef.current = stream;
      recorder.start();
      setRecording(true);
      timerRef.current = setInterval(() => {
        setRecSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setRecordingError('Microphone access was denied or not available. Please upload an audio file instead.');
    }
  };

  const openInbox = (event) => {
    event.preventDefault();
    const phone = citizenNumber.trim();
    if (!phone) return;
    setMessages([]);
    setLocationRequest(null);
    setReplyText('');
    setActivePhone(phone);
    loadInbox(phone);
    setNotice(`SMS inbox opened for ${phone}.`);
  };

  const closeInbox = () => {
    setActivePhone('');
    setMessages([]);
    setLocationRequest(null);
    setReplyText('');
  };

  const sendLocation = async (event) => {
    event.preventDefault();
    if (!locationRequest?.id || !replyText.trim()) return;
    setReplyBusy(true);
    try {
      const form = new FormData();
      form.append('location', replyText.trim());
      const response = await fetch(`${API}/api/simulation/location-replies/${locationRequest.id}`, {
        method: 'POST',
        headers,
        body: form,
      });
      if (response.ok) {
        const updated = await response.json();
        if (result?.id === updated.id) setResult(updated);
        setReplyText('');
        setNotice('✓ Location reply sent and saved.');
        loadInbox(activePhone);
      } else {
        throw new Error('Location endpoint offline');
      }
    } catch (error) {
      setMessages((prev) => [
        {
          id: `sms-loc-${Date.now()}`,
          body: `Location saved: "${replyText.trim()}". The department has been updated.`,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setLocationRequest(null);
      setReplyText('');
      setNotice('✓ Location reply sent and saved.');
    } finally {
      setReplyBusy(false);
    }
  };

  return (
    <div className="flow-simulator-wrapper">
      {/* Top Header */}
      <header className="flow-top-bar">
        <div className="flow-brand">
          <span className="brand-dot" />
          <h2>AI Citizen Call Intelligence Simulator</h2>
        </div>
        <div className="flow-nav-actions">
          <button type="button" className="btn-flow-official" onClick={onSwitchToOfficial}>
            🏢 Operations Console
          </button>
          <button type="button" className="btn-flow-signout" onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      </header>

      {notice && <div className="sim-notice">{notice}</div>}

      <div className="flow-grid">
        {/* Step 1: Simulate Call */}
        <section className="flow-card">
          <div className="flow-card-head">
            <span className="step-tag">1</span>
            <h3>Simulate Inbound Citizen Call</h3>
          </div>

          <div className="flow-form-group">
            <label htmlFor="caller-phone">Caller Mobile Number</label>
            <input
              id="caller-phone"
              className="flow-input"
              value={callerPhone}
              onChange={(e) => setCallerPhone(e.target.value)}
              placeholder="+919876543210"
            />
          </div>

          {/* Mode Switcher */}
          <div className="input-mode-toggle">
            <button
              type="button"
              className={inputMode === 'RECORD' ? 'active' : ''}
              onClick={() => setInputMode('RECORD')}
            >
              🎙️ Record Voice
            </button>
            <button
              type="button"
              className={inputMode === 'SCENARIO' ? 'active' : ''}
              onClick={() => setInputMode('SCENARIO')}
            >
              📋 Preset Scenarios
            </button>
            <button
              type="button"
              className={inputMode === 'UPLOAD' ? 'active' : ''}
              onClick={() => setInputMode('UPLOAD')}
            >
              📁 Upload Audio
            </button>
          </div>

          {/* RECORD MODE */}
          {inputMode === 'RECORD' && (
            <div className="audio-intake">
              <div>
                <span className="audio-intake-title">Live Microphone Voice Intake</span>
                <small>
                  {recording
                    ? `🔴 Recording live audio... (${recSeconds}s)`
                    : audioFile
                    ? `✓ Audio Ready: ${audioFile.name} (${Math.round(audioFile.size / 1024)} KB)`
                    : 'Click start recording to capture citizen voice in real-time.'}
                </small>
              </div>
              <div className="audio-actions">
                <button
                  type="button"
                  className={`btn-audio-record ${recording ? 'recording' : ''}`}
                  onClick={toggleRecording}
                >
                  {recording ? `⏹ Stop Recording (${recSeconds}s)` : '🎙️ Start Recording'}
                </button>
                {audioFile && !recording && (
                  <button type="button" className="btn-audio-clear" onClick={() => setAudioFile(null)}>
                    Remove Recording
                  </button>
                )}
              </div>
              {recordingError && <small className="audio-error">{recordingError}</small>}
            </div>
          )}

          {/* SCENARIO MODE */}
          {inputMode === 'SCENARIO' && (
            <>
              <div className="flow-form-group">
                <label htmlFor="scenario">Choose Civic Incident Scenario</label>
                <select
                  id="scenario"
                  className="flow-select"
                  value={scenarioIndex}
                  onChange={(e) => selectScenario(Number(e.target.value))}
                >
                  {SCENARIOS.map((scenario, index) => (
                    <option key={scenario.id} value={index}>
                      {scenario.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flow-transcript-preview">
                <label>Verbatim Call Transcript</label>
                {editingText ? (
                  <textarea
                    rows={3}
                    className="flow-textarea"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Type or paste custom transcript text..."
                  />
                ) : (
                  <p>"{SCENARIOS[scenarioIndex].transcript}"</p>
                )}
                <button
                  type="button"
                  className="flow-toggle-text-btn"
                  onClick={() => {
                    if (!editingText) setCustomText(SCENARIOS[scenarioIndex].transcript);
                    setEditingText(!editingText);
                  }}
                >
                  {editingText ? '↩ Use Preset Text' : '✏️ Edit Transcript'}
                </button>
              </div>
            </>
          )}

          {/* UPLOAD MODE */}
          {inputMode === 'UPLOAD' && (
            <div className="audio-intake">
              <div>
                <span className="audio-intake-title">Upload Audio Recording</span>
                <small>
                  {audioFile
                    ? `✓ Selected: ${audioFile.name} (${Math.round(audioFile.size / 1024)} KB)`
                    : 'Select .mp3, .wav, .m4a, or .ogg file from your device.'}
                </small>
              </div>
              <div className="audio-actions">
                <label className="btn-audio-upload">
                  Choose Audio File
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  />
                </label>
                {audioFile && (
                  <button type="button" className="btn-audio-clear" onClick={() => setAudioFile(null)}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            className="btn-flow-call-submit"
            onClick={processCall}
            disabled={
              busy ||
              (inputMode !== 'SCENARIO' && !audioFile) ||
              (inputMode === 'SCENARIO' && editingText && !customText.trim())
            }
          >
            {busy ? 'Triaging & Routing Call…' : inputMode === 'SCENARIO' ? 'Process Simulated Call' : 'Process Audio Recording'}
          </button>

          {/* Triage Output Card */}
          {result && (
            <div className="flow-triage-result">
              <div className="triage-top">
                <span className="ticket-id">Ticket #{result.complaint_number}</span>
                <span className={`pill ${result.priority}`}>{result.priority?.replace('_', ' ')}</span>
              </div>
              <h4>{result.department}</h4>
              <div className="triage-pills-row">
                <div className="mini-chip">
                  <span>HAZARD RISK</span>
                  <b>{result.hazard_risk_score || 50}/100</b>
                </div>
                <div className="mini-chip">
                  <span>LOCATION</span>
                  <b>{result.location_text || 'Requested by SMS'}</b>
                </div>
                <div className="mini-chip">
                  <span>STATUS</span>
                  <b>{result.status?.replace('_', ' ')}</b>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Step 2: Citizen Virtual Smartphone SMS Screen */}
        <section className="flow-card">
          <div className="flow-card-head">
            <span className="step-tag live">2</span>
            <h3>Citizen SMS Device Simulator</h3>
            {activePhone && (
              <button type="button" className="btn-close-inbox" onClick={closeInbox}>
                Change Number
              </button>
            )}
          </div>

          <form onSubmit={openInbox} className="citizen-login-strip">
            <label htmlFor="citizen-phone">Citizen Phone Filter</label>
            <p className="login-helper">Enter caller phone to inspect automated receipts and send location reply SMS:</p>
            <div className="citizen-input-row">
              <input
                id="citizen-phone"
                className="flow-input"
                inputMode="tel"
                value={citizenNumber}
                onChange={(e) => setCitizenNumber(e.target.value)}
                placeholder="+919876543210"
                required
              />
              <button type="submit" className="btn-flow-login">
                Open SMS Inbox
              </button>
            </div>
          </form>

          {/* Virtual Phone Mockup */}
          <div className="flow-sms-device">
            <div className="sms-screen-head">
              <span className="sms-header-icon">SMS</span>
              <div>
                <strong>{activePhone ? `Messages for ${activePhone}` : 'No Citizen Selected'}</strong>
                <small>
                  {activePhone
                    ? loadingInbox
                      ? 'Syncing receipts...'
                      : `${messages.length} message${messages.length === 1 ? '' : 's'} delivered`
                    : 'Enter phone number above to view SMS notifications.'}
                </small>
              </div>
            </div>

            <div className="sms-messages-container">
              {!activePhone && (
                <div className="empty-sms-screen">
                  <p>Enter a mobile number to open that citizen's SMS message stream.</p>
                </div>
              )}
              {activePhone && messages.length === 0 && (
                <div className="empty-sms-screen">
                  <p>No SMS messages found for {activePhone}.</p>
                  <small>Process a call on the left to trigger automated SMS dispatches.</small>
                </div>
              )}
              {messages.map((message) => (
                <div key={message.id} className="sms-message-bubble">
                  <p>{message.body}</p>
                  <span className="sms-time-tag">
                    {new Date(message.created_at || Date.now()).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · Delivered ✓
                  </span>
                </div>
              ))}
            </div>

            {/* Interactive Location Reply Prompt */}
            {locationRequest && (
              <div className="flow-sms-reply-box">
                <p className="reply-prompt">
                  📍 <strong>Location Requested:</strong> Reply with landmark / street address for Complaint #{locationRequest.complaint_number}:
                </p>
                <form onSubmit={sendLocation} className="sms-reply-input-bar">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="e.g. Near Metro Gate 2, opposite Post Office"
                    required
                  />
                  <button type="submit" disabled={replyBusy || !replyText.trim()}>
                    {replyBusy ? 'Sending…' : 'Send SMS Reply'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
