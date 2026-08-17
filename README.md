# Citizen Call Intelligence

Internal government system with a default **Call Simulation Mode**. It demonstrates calls, classification, routing, duplicate handling, location follow-up, and SMS notifications without any telephony account. Only Head Office and authorised Department users log in; there is no public web portal.

## Roles

- **Head Office**: views all incidents and analytics, and can reassign any incident to one of the approved departments.
- **Department Officer**: sees only their assigned department queue and can start work or resolve incidents. Resolution is immediately visible to Head Office and sends SMS to the original caller plus every linked duplicate caller.

Approved classifier departments: Municipal Corporation & Sanitation; Public Works (PWD) & Roads; Water Supply & Sewerage Board; Electricity & Power Distribution; Traffic & Urban Mobility.

## Run locally

1. Install [MongoDB Community Server](https://www.mongodb.com/try/download/community), then ensure the MongoDB service is running.
2. Install Python 3.11 or 3.12 (the checked-in virtual environment is not portable). From `backend`, create and activate an environment:
   - PowerShell: `py -3.12 -m venv .venv; .\.venv\Scripts\Activate.ps1`
   - `pip install -r requirements.txt`
3. Copy `backend/.env.example` to `backend/.env` and replace every development credential.
4. Start the API: from `backend`, run `uvicorn app.main:app --reload`.
5. Start the dashboard: from `Frontend`, run `npm install` then `npm run dev`.
6. Open the URL printed by Vite (normally `http://localhost:5173`). Log in with the values configured in `.env`.

## Demo without Exotel

`TELEPHONY_MODE=simulation` is the default. Log in with the separate **Simulation Operator** account and upload an MP3, WAV, M4A, or OGG citizen complaint recording plus a caller number. The simulator saves the audio locally, runs speech-to-text, then runs the same classifier and duplicate logic as production. Every acknowledgement, missing-location request, and resolution message appears in the simulation SMS Outbox instead of being sent to a phone. Head Office and Department Officer accounts remain separate from the simulation portal.

## MongoDB synthetic logins

The login service reads the `users` collection in MongoDB. Import the ready-made demo accounts after MongoDB starts:

```powershell
cd backend
python seed/import_users.py
```

The import file is `backend/seed/users.seed.json`. It contains one Head account (`head_admin`), a separate Simulator account (`simulator_demo`), and one department account for each of the five departments. These are demo-only plain-text passwords, because this build intentionally has password hashing disabled.

Use `simulator_demo` / `Sim@123` only for the independent audio-upload simulator. Use `head_admin` / `Head@123` for the Head dashboard. Department logins only see their own queue.

## Optional: Exotel production setup

- Create an Exotel trial account, complete KYC when moving beyond its restricted testing mode, and obtain an ExoPhone / virtual number. Copy **Account SID**, **API Key**, **API Token**, and ExoPhone into the matching `EXOTEL_*` entries in `.env`.
- Expose the backend with `ngrok http 8000` during development and set its HTTPS forwarding address as `PUBLIC_BASE_URL`. Do not use ngrok in production.
- In Exotel App Builder, create a flow: **Greeting** → **PassThru** → **Connect to a department/call-centre group** (or your approved voice-message capture applet) → **end**. Configure the PassThru callback to `GET https://your-domain/exotel/call-start`. The backend begins call-level recording and uses `https://your-domain/exotel/recording-status` as its recording callback when the recording is complete.
- Configure Exotel’s inbound-SMS / New Text callback to `POST https://your-domain/exotel/sms`. This receives citizen location replies.
- Register the government organisation as the Principal Entity in the applicable DLT portal, register exact transactional SMS templates, link the Exotel sender ID, then set `EXOTEL_DLT_TEMPLATE_ID`. Production SMS text must exactly match its approved DLT template.

## Required keys / where to obtain them

- **MongoDB**: no key for local MongoDB. For MongoDB Atlas, create a free cluster, create a database user, allow your IP address, and copy its connection string into `MONGODB_URI`.
- **Exotel**: account credentials appear in Exotel Dashboard → API settings. India-hosted accounts use `https://api.in.exotel.com`.
- **Classification key (optional)**: the supplied classifier module uses Groq by default. Create a key at [Groq Console](https://console.groq.com/keys), set `GROQ_API_KEY`, and use `LLM_PROVIDER=groq`. Alternatively install Ollama, set `LLM_PROVIDER=ollama`, and set `OLLAMA_MODEL`.

## Important deployment safeguards

- Exotel records simultaneous calls independently, so callers are not rejected as busy. For live call-centre hand-off, configure an Exotel Connect Applet to a group; Exotel recommends groups for load distribution. Recording and complaint creation remain independent of agent availability.
- Set a random `JWT_SECRET` and strong passwords before use. Add all department accounts through `DEPARTMENT_ACCOUNTS_JSON` as demonstrated in `.env.example`.
- Validate Exotel callbacks with an application-level shared secret or IP allowlist, move local recordings to encrypted object storage, and run transcription in Celery/RQ/SQS for production.
- The existing classifier is used first. Its outputs are constrained to the five approved departments; missing or uncertain locations trigger an SMS request, and only a logged-in officer can resolve an incident.
