"use strict";

const $ = (sel) => document.querySelector(sel);

const elText = $("#grievanceText");
const btnSubmit = $("#btnSubmit");
const btnMic = $("#btnMic");
const micLabel = $("#micLabel");
const recTimer = $("#recTimer");
const formMsg = $("#formMsg");
const resultArea = $("#resultArea");
const cardResult = $("#cardResult");
const spinner = $("#spinner");
const serverStatus = $("#serverStatus");

const deptFilter = $("#deptFilter");
const prioFilter = $("#prioFilter");
const searchBox = $("#searchBox");

let allRecords = [];
let mediaRecorder = null;
let recChunks = [];
let recStart = null;
let timerInterval = null;

/* ---------------- tabs ---------------- */
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    $("#tab-" + tab.dataset.tab).classList.add("active");
    if (tab.dataset.tab === "track") loadComplaints();
  });
});

/* ---------------- server status ---------------- */
fetch("/api/complaints")
  .then((r) => r.ok ? null : Promise.reject())
  .then(() => setStatus(true))
  .catch(() => setStatus(false));

function setStatus(ok) {
  serverStatus.classList.toggle("online", ok);
  serverStatus.classList.toggle("offline", !ok);
  serverStatus.innerHTML = `<span class="dot"></span> ${ok ? "Backend online" : "Backend offline"}`;
}

/* ---------------- helpers ---------------- */
function showMsg(kind, text, keep) {
  formMsg.classList.remove("hidden", "error", "ok");
  formMsg.classList.add(kind);
  formMsg.textContent = text;
  if (!keep) setTimeout(() => formMsg.classList.add("hidden"), 6000);
}

function showSpinner(on) {
  spinner.classList.toggle("hidden", !on);
  btnSubmit.disabled = on;
  btnMic.disabled = on;
}

function priorityClass(p) {
  const map = { "P1-Emergency": "p1", "P2-High": "p2", "P3-Medium": "p3", "P4-Low": "p4" };
  return map[p] || "p3";
}

function riskClass(s) {
  if (s >= 70) return "high";
  if (s >= 40) return "mid";
  return "low";
}

function esc(s) {
  const div = document.createElement("div");
  div.textContent = String(s ?? "");
  return div.innerHTML;
}

function fmtDate(iso) {
  if (!iso) return "-";
  try { return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return "-"; }
}

/* ---------------- text processing ---------------- */
btnSubmit.addEventListener("click", async () => {
  const text = elText.value.trim();
  if (!text) { showMsg("error", "Please type or paste a grievance first."); return; }
  formMsg.classList.add("hidden");
  showSpinner(true);
  try {
    const res = await fetch("/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    renderResult(data);
    elText.value = "";
  } catch (err) {
    showMsg("error", "Processing failed: " + err.message);
    resultArea.classList.add("hidden");
  } finally {
    showSpinner(false);
  }
});

/* ---------------- voice recording ---------------- */
btnMic.addEventListener("click", async () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    return;
  }
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    showMsg("error", "Voice recording is not supported in this browser. Use Chrome or Edge.");
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showMsg("error", "Microphone access denied.");
    return;
  }
  recChunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => { if (e.data.size) recChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    clearInterval(timerInterval);
    recTimer.classList.add("hidden");
    micLabel.textContent = "Record Voice";
    btnMic.classList.remove("recording");
    const blob = new Blob(recChunks, { type: mediaRecorder.mimeType || "audio/webm" });
    if (blob.size < 1000) { showMsg("error", "Recording was too short. Try again."); return; }
    uploadAudio(blob);
  };
  mediaRecorder.start();
  recStart = Date.now();
  btnMic.classList.add("recording");
  micLabel.textContent = "Stop";
  recTimer.classList.remove("hidden");
  timerInterval = setInterval(() => {
    recTimer.textContent = `Recording... ${Math.round((Date.now() - recStart) / 1000)}s`;
  }, 500);
});

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (const s of samples) view.setInt16(off, Math.max(-1, Math.min(1, s)) * 0x7fff, true), off += 2;
  return new Blob([buffer], { type: "audio/wav" });
}

async function blobToWav(blob, targetRate = 16000) {
  const arrayBuf = await blob.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
  const src = audioCtx.createBufferSource();
  src.buffer = audioBuf;
  const off = audioCtx.createScriptProcessor(0, audioBuf.numberOfChannels, 1);
  const filtered = audioCtx.createBiquadFilter();
  filtered.type = "lowpass";
  filtered.frequency.value = 8000;
  src.connect(filtered);
  filtered.connect(off);
  off.connect(audioCtx.destination);
  const channel = audioBuf.getChannelData(0);
  const down = new Float32Array(Math.floor(audioBuf.duration * targetRate));
  const ratio = audioBuf.sampleRate / targetRate;
  for (let i = 0; i < down.length; i++) down[i] = channel[Math.floor(i * ratio)] || 0;
  return encodeWav(down, targetRate);
}

async function uploadAudio(blob) {
  showSpinner(true);
  resultArea.classList.add("hidden");
  try {
    const wav = await blobToWav(blob, 16000);
    const res = await fetch("/api/audio", { method: "POST", body: wav });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Audio processing failed");
    renderResult(data.record, data.transcript);
  } catch (err) {
    showMsg("error", "Voice processing failed: " + err.message);
  } finally {
    showSpinner(false);
  }
}

/* ---------------- result rendering ---------------- */
function renderResult(record, transcript) {
  resultArea.classList.remove("hidden");
  if (!record.is_civic_related) {
    cardResult.innerHTML = `
      <div class="card result-card">
        <div class="result-head">
          <h3>Not a civic service complaint</h3>
          <span class="badge rejected">Rejected</span>
        </div>
        <div class="reject-box">
          <strong>This complaint is not related to the 5 civic services supported by GovPulse AI.</strong>
          Please register complaints about:
          <ol>
            <li>Municipal Corporation &amp; Sanitation</li>
            <li>Public Works (PWD) &amp; Roads</li>
            <li>Water Supply &amp; Sewerage Board</li>
            <li>Electricity &amp; Power Distribution</li>
            <li>Traffic &amp; Urban Mobility</li>
          </ol>
        </div>
        ${transcript ? `<p class="hint" style="margin-top:12px">Transcript: &ldquo;${esc(transcript)}&rdquo;</p>` : ""}
      </div>`;
    return;
  }
  const pc = priorityClass(record.urgency_priority);
  cardResult.innerHTML = `
    <div class="card result-card ${pc}">
      <div class="result-head">
        <h3>${esc(record.complaint_id)}</h3>
        <div>
          <span class="badge ${pc}">${esc(record.urgency_priority)}</span>
          <span class="badge dept">${esc(record.department)}</span>
        </div>
      </div>
      ${transcript ? `<p class="hint">Transcript: &ldquo;${esc(transcript)}&rdquo;</p>` : ""}
      <div class="grid">
        <div class="field"><div class="k">Category</div><div class="v">${esc(record.issue_sub_category)}</div></div>
        <div class="field"><div class="k">Risk Score</div><div class="v"><span class="riskbar ${riskClass(record.hazard_risk_score)}">${record.hazard_risk_score}/100</span></div></div>
        <div class="field"><div class="k">Landmark</div><div class="v">${esc(record.extracted_landmark)}</div></div>
        <div class="field"><div class="k">Detected Language</div><div class="v">${esc(record.detected_language)}</div></div>
        <div class="field"><div class="k">Action Required</div><div class="v">${esc(record.action_required)}</div></div>
        <div class="field"><div class="k">Suggested SMS to Citizen</div><div class="v sms">${esc(record.suggested_sms_reply)}</div></div>
      </div>
    </div>`;
  loadComplaints();
}

/* ---------------- dashboard ---------------- */
async function loadComplaints() {
  try {
    const res = await fetch("/api/complaints");
    if (!res.ok) throw new Error("Failed to load");
    allRecords = (await res.json()).records || [];
  } catch {
    allRecords = [];
  }
  renderStats();
  renderTable();
}

function renderStats() {
  const total = allRecords.length;
  const depts = {};
  const prios = {};
  let p1Count = 0;
  allRecords.forEach((r) => {
    if (!r.is_civic_related) return;
    depts[r.department] = (depts[r.department] || 0) + 1;
    prios[r.urgency_priority] = (prios[r.urgency_priority] || 0) + 1;
    if (r.urgency_priority === "P1-Emergency") p1Count++;
  });
  const cards = [
    { n: total, l: "Total Complaints" },
    { n: p1Count, l: "P1 Emergencies" },
  ];
  Object.entries(depts).slice(0, 3).forEach(([k, v]) => cards.push({ n: v, l: k.split("&")[0].trim() }));
  $("#stats").innerHTML = cards
    .map((c) => `<div class="stat"><div class="n">${c.n}</div><div class="l">${esc(c.l)}</div></div>`)
    .join("");
}

function renderTable() {
  const q = searchBox.value.trim().toLowerCase();
  const d = deptFilter.value;
  const p = prioFilter.value;
  const rows = allRecords.filter((r) => {
    if (!r.is_civic_related) return false;
    if (d && r.department !== d) return false;
    if (p && r.urgency_priority !== p) return false;
    if (q && !(`${r.complaint_id} ${r.raw_transcript} ${r.extracted_landmark} ${r.issue_sub_category}`.toLowerCase().includes(q))) return false;
    return true;
  });
  const tbody = document.querySelector("#complaintsTable tbody");
  $("#emptyMsg").classList.toggle("hidden", rows.length > 0);
  $("#complaintsTable").classList.toggle("hidden", rows.length === 0);
  tbody.innerHTML = rows
    .map((r) => `
      <tr>
        <td><strong>${esc(r.complaint_id)}</strong></td>
        <td>${esc(r.department)}</td>
        <td><span class="short" title="${esc(r.issue_sub_category)}">${esc(r.issue_sub_category)}</span></td>
        <td><span class="badge ${priorityClass(r.urgency_priority)}">${esc(r.urgency_priority)}</span></td>
        <td><span class="riskbar ${riskClass(r.hazard_risk_score)}">${r.hazard_risk_score}</span></td>
        <td><span class="short" title="${esc(r.extracted_landmark)}">${esc(r.extracted_landmark)}</span></td>
        <td>${esc(r.detected_language)}</td>
        <td>${fmtDate(r.created_at)}</td>
      </tr>`)
    .join("");
}

searchBox.addEventListener("input", renderTable);
deptFilter.addEventListener("change", renderTable);
prioFilter.addEventListener("change", renderTable);
