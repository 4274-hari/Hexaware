import React, { useEffect, useRef, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const SCENARIOS = [
  { id: 'water', title: 'Water pipe burst - Gandhi Circle', phone: '+919876543210', transcript: 'Main drinking water pipeline has burst near Gandhi Circle opposite post office. Clean water is flooding the street.' },
  { id: 'wire', title: 'Live electric wire - emergency', phone: '+919840123456', transcript: 'Emergency! High voltage electric wire snapped and sparking in front of Anna Nagar bus stand! Life threatening electrocution hazard!' },
  { id: 'pothole', title: 'Deep pothole - Ring Road', phone: '+919444567890', transcript: 'A massive 2-foot deep pothole has opened up on Ring Road near flyover causing vehicle damage and accidents.' },
  { id: 'location', title: 'Missing location follow-up', phone: '+919380998877', transcript: 'The streetlights in my area have been dark for three days. Please repair them.' },
];

export default function Simulator({ session, onSignOut, onSwitchToOfficial }) {
  const headers = { Authorization: `Bearer ${session.access_token}` };
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [callerPhone, setCallerPhone] = useState(SCENARIOS[0].phone);
  const [customText, setCustomText] = useState('');
  const [editingText, setEditingText] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [recording, setRecording] = useState(false);
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
  const [inputMode, setInputMode] = useState('RECORD');
  const recorderRef = useRef(null);
  const streamRef = useRef(null);

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
    } finally { setLoadingInbox(false); }
  };

  useEffect(() => {
    if (!activePhone) return undefined;
    loadInbox(activePhone);
    const refresh = setInterval(() => loadInbox(activePhone), 3000);
    return () => clearInterval(refresh);
  }, [activePhone]);
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const selectScenario = (index) => { setScenarioIndex(index); setCallerPhone(SCENARIOS[index].phone); setEditingText(false); };
  const processCall = async () => {
    const transcript = editingText ? customText : SCENARIOS[scenarioIndex].transcript;
    if (!audioFile && !transcript.trim()) return;
    setBusy(true); setNotice('');
    try {
      let response;
      if (audioFile) {
        const form = new FormData();
        form.append('caller_phone', callerPhone.trim());
        form.append('audio', audioFile, audioFile.name || 'voice-recording.webm');
        response = await fetch(`${API}/api/simulation/calls`, { method: 'POST', headers, body: form });
      } else {
        response = await fetch(`${API}/api/simulation/calls/text`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ caller_phone: callerPhone.trim(), transcript: transcript.trim(), language: 'en' }) });
      }
      if (!response.ok) throw new Error('Call processing failed.');
      setResult(await response.json());
      setNotice('Call processed. Open the SMS inbox with the caller number to view its messages.');
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };

  const toggleRecording = async () => {
    if (recording) { recorderRef.current?.stop(); return; }
    try {
      setRecordingError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream); const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        setAudioFile(new File([blob], 'voice-recording.webm', { type: blob.type }));
        setRecording(false); stream.getTracks().forEach((track) => track.stop()); streamRef.current = null;
      };
      recorderRef.current = recorder; streamRef.current = stream; recorder.start(); setRecording(true);
    } catch { setRecordingError('Microphone access was not available. Upload an audio file instead.'); }
  };

  const openInbox = (event) => {
    event.preventDefault(); const phone = citizenNumber.trim(); if (!phone) return;
    setMessages([]); setLocationRequest(null); setReplyText(''); setActivePhone(phone); loadInbox(phone);
    setNotice(`SMS inbox opened for ${phone}.`);
  };
  const closeInbox = () => { setActivePhone(''); setMessages([]); setLocationRequest(null); setReplyText(''); };
  const sendLocation = async (event) => {
    event.preventDefault(); if (!locationRequest?.id || !replyText.trim()) return;
    setReplyBusy(true);
    try {
      const form = new FormData(); form.append('location', replyText.trim());
      const response = await fetch(`${API}/api/simulation/location-replies/${locationRequest.id}`, { method: 'POST', headers, body: form });
      if (!response.ok) throw new Error('Location reply could not be recorded.');
      const updated = await response.json(); if (result?.id === updated.id) setResult(updated);
      setReplyText(''); setNotice('Location received and saved.'); loadInbox(activePhone);
    } catch (error) { setNotice(error.message); } finally { setReplyBusy(false); }
  };

  const hasLocationMessage = messages.some((message) => /reply\s+with.*(street|landmark|locality|location)|location.*reply/i.test(message.body || ''));
  return <div className="flow-simulator-wrapper civic-theme">
    <header className="flow-top-bar"><div className="flow-brand"><span className="brand-dot" /><h2>Civic Assist Simulator</h2></div><div className="flow-nav-actions"><button type="button" className="btn-flow-official" onClick={onSwitchToOfficial}>Operations console</button><button type="button" className="btn-flow-signout" onClick={onSignOut}>Sign out</button></div></header>
    {notice && <div className="sim-notice">{notice}</div>}
    <div className="flow-grid">
      <section className="flow-card simulator-main-card">
        <div className="flow-card-head"><span className="step-tag">1</span><h3>Simulate a citizen call</h3></div>
        <div className="flow-form-group"><label htmlFor="caller-phone">Caller mobile number</label><input id="caller-phone" className="flow-input" value={callerPhone} onChange={(e) => setCallerPhone(e.target.value)} /></div>
        <div className="input-mode-toggle"><button type="button" className={inputMode === 'RECORD' ? 'active' : ''} onClick={() => setInputMode('RECORD')}>Record voice</button><button type="button" className={inputMode === 'SCENARIO' ? 'active' : ''} onClick={() => setInputMode('SCENARIO')}>Test scenario</button><button type="button" className={inputMode === 'UPLOAD' ? 'active' : ''} onClick={() => setInputMode('UPLOAD')}>Upload audio</button></div>
        {inputMode === 'SCENARIO' && <><div className="flow-form-group"><label htmlFor="scenario">Test scenario</label><select id="scenario" className="flow-select" value={scenarioIndex} onChange={(e) => selectScenario(Number(e.target.value))}>{SCENARIOS.map((scenario, index) => <option key={scenario.id} value={index}>{scenario.title}</option>)}</select></div><div className="flow-transcript-preview"><label>Complaint transcript</label>{editingText ? <textarea rows={3} className="flow-textarea" value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="Type the complaint" /> : <p>"{SCENARIOS[scenarioIndex].transcript}"</p>}<button type="button" className="flow-toggle-text-btn" onClick={() => setEditingText(!editingText)}>{editingText ? 'Use preset text' : 'Edit transcript'}</button></div></>}
        {inputMode === 'RECORD' && <div className="audio-intake"><div><span className="audio-intake-title">Record a voice complaint</span><small>{audioFile ? `Ready: ${audioFile.name}` : 'Use your microphone, then process the recording.'}</small></div><div className="audio-actions"><button type="button" className={`btn-audio-record ${recording ? 'recording' : ''}`} onClick={toggleRecording}>{recording ? 'Stop recording' : 'Start recording'}</button>{audioFile && <button type="button" className="btn-audio-clear" onClick={() => setAudioFile(null)}>Remove</button>}</div>{recordingError && <small className="audio-error">{recordingError}</small>}</div>}
        {inputMode === 'UPLOAD' && <div className="audio-intake"><div><span className="audio-intake-title">Upload an audio complaint</span><small>{audioFile ? `Ready: ${audioFile.name}` : 'Select an audio file from this device.'}</small></div><div className="audio-actions"><label className="btn-audio-upload">Choose audio file<input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} /></label>{audioFile && <button type="button" className="btn-audio-clear" onClick={() => setAudioFile(null)}>Remove</button>}</div></div>}
        <button type="button" className="btn-flow-call-submit" onClick={processCall} disabled={busy || (inputMode !== 'SCENARIO' && !audioFile) || (inputMode === 'SCENARIO' && editingText && !customText.trim())}>{busy ? 'Processing...' : inputMode === 'SCENARIO' ? 'Process call' : 'Process audio'}</button>
        {result && <div className="flow-triage-result"><div className="triage-top"><span className="ticket-id">{result.complaint_number}</span><span className={`pill ${result.priority}`}>{result.priority?.replace('_', ' ')}</span></div><h4>{result.department}</h4><div className="triage-pills-row"><div className="mini-chip"><span>RISK</span><b>{result.hazard_risk_score || 50}/100</b></div><div className="mini-chip"><span>LOCATION</span><b>{result.location_text || 'Requested by SMS'}</b></div><div className="mini-chip"><span>STATUS</span><b>{result.status?.replace('_', ' ')}</b></div></div></div>}
      </section>
      <section className="flow-card simulator-main-card">
        <div className="flow-card-head"><span className="step-tag live">2</span><h3>Citizen SMS inbox</h3>{activePhone && <button type="button" className="btn-close-inbox" onClick={closeInbox}>Close inbox</button>}</div>
        <form onSubmit={openInbox} className="citizen-login-strip"><label htmlFor="citizen-phone">Citizen SMS sign-in</label><p className="login-helper">Enter a mobile number to view only that citizen's messages.</p><div className="citizen-input-row"><input id="citizen-phone" className="flow-input" inputMode="tel" value={citizenNumber} onChange={(e) => setCitizenNumber(e.target.value)} placeholder="+919876543210" required /><button type="submit" className="btn-flow-login">Open inbox</button></div></form>
        <div className="flow-sms-device"><div className="sms-screen-head"><span className="sms-header-icon">SMS</span><div><strong>{activePhone ? `Messages for ${activePhone}` : 'Sign in to view messages'}</strong><small>{activePhone ? (loadingInbox ? 'Updating...' : `${messages.length} message${messages.length === 1 ? '' : 's'}`) : 'Messages stay private until a number is entered.'}</small></div></div><div className="sms-messages-container">{!activePhone && <div className="empty-sms-screen"><p>Enter a mobile number above to open that citizen's inbox.</p></div>}{activePhone && messages.length === 0 && <div className="empty-sms-screen"><p>No SMS messages found for {activePhone}.</p><small>Process a call with this number to receive an automated SMS.</small></div>}{messages.map((message) => <div key={message.id} className="sms-message-bubble"><p>{message.body}</p><span className="sms-time-tag">{new Date(message.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - Delivered</span></div>)}</div>{locationRequest && <div className="flow-sms-reply-box"><p className="reply-prompt">Location requested for this complaint. Send the citizen's location reply below.</p><form onSubmit={sendLocation} className="sms-reply-input-bar"><input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="e.g. Near Metro Gate 2, Post Office" /><button type="submit" disabled={replyBusy || !replyText.trim()}>{replyBusy ? 'Sending...' : 'Send location'}</button></form></div>}</div>
      </section>
    </div>
  </div>;
}
