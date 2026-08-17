# Task: Build the GovPulse AI Backend

You are working in the repo `Hexaware/Hexaware` (workspace root). Create
a new folder `backend/` here and build the GovPulse AI civic grievance
triage backend inside it.

## Step 1 — Create the folder and files

Create exactly these files:
1. `backend/requirements.txt`
2. `backend/prompt_templates.py`
3. `backend/backend_engine.py`
4. `backend/complaints_store.json` (content: `[]`)
5. `backend/.env` (content: `GROQ_API_KEY=` — empty, user fills it later)

## Step 2 — File contents

### requirements.txt (exact text)
```
groq>=0.9.0
pydantic>=2.0.0
python-dotenv>=1.0.0
```

### prompt_templates.py
Define a system prompt string plus a few-shot examples list.

The system prompt must instruct the model to:
- Accept transcripts in English, Tamil, Tanglish, Hindi, or code-mixed speech.
- Classify into EXACTLY one of these 5 departments:
  "Municipal Corporation & Sanitation", "Public Works (PWD) & Roads",
  "Water Supply & Sewerage Board", "Electricity & Power Distribution",
  "Traffic & Urban Mobility".
- Assign EXACTLY one urgency from: "P1-Emergency" (live wires, open
  manholes), "P2-High" (pipeline bursts, sewage flooding, signal
  failure), "P3-Medium" (overflowing bins, dead streetlights,
  non-critical potholes), "P4-Low" (minor maintenance, low pressure).
- Score hazard_risk_score as integer 1–100: life hazards >90,
  major water/flood 70–89, trash/minor 1–69.
- Return ONLY a JSON object matching the schema below. No prose.

Add these 4 few-shot examples (each a full JSON object per the schema):
1. Tanglish live wire → Electricity, P1-Emergency, risk 98
2. English sewage drain leak → Water Supply & Sewerage Board,
   P2-High, risk 76
3. English open manhole on highway → Public Works (PWD) & Roads,
   P1-Emergency, risk 92
4. Hinglish overflowing trash → Municipal Corporation & Sanitation,
   P3-Medium, risk 45

Also define a constant with the exact JSON output schema.

### backend_engine.py
- Import dotenv and call `load_dotenv()`. Get the key with
  `os.environ.get("GROQ_API_KEY")`. If it is missing or empty, print a
  clear error message and call `sys.exit(1)`.
- Create `client = Groq()`.
- Function `save_complaint_to_store(record: dict, filename: str =
  "complaints_store.json")`:
  - If the file is missing, empty, or contains invalid JSON, start with
    an empty list.
  - Prepend the record: `data.insert(0, record)`.
  - Write with `open(filename, "w", encoding="utf-8")` and
    `json.dump(data, f, ensure_ascii=False, indent=2)`.
- Function `next_complaint_id() -> str`:
  - Read existing records from complaints_store.json, find the highest
    numeric suffix of any `complaint_id`, and return the next as
    `INC-2026-XXXX` zero-padded to 4 digits. If the file is empty,
    return `INC-2026-0001`.
- Function `process_grievance_text(transcript_text: str) -> dict`:
  - Generate the complaint id via `next_complaint_id()`.
  - Call `client.chat.completions.create(...)` with
    `model="llama-3.3-70b-versatile"`, `temperature=0.1`,
    `response_format={"type": "json_object"}`, a `messages` list with
    the system prompt from prompt_templates.py and the transcript as
    user content. Use `try/except` and print a readable error message on
    failure.
  - Parse the JSON response with `json.loads(...)`. If parsing fails or
    the object lacks required keys, print an error and return `None`.
  - Overwrite the `complaint_id` field with the generated id, and add a
    `created_at` field with the current ISO-8601 timestamp.
  - Call `save_complaint_to_store(record)`.
  - Return the dict.
- Function `interactive_cli()`:
  - Print a clean ASCII banner "GovPulse AI Triage Engine".
  - Loop: prompt `Enter simulated transcript (or 'exit' to quit): > `
    (strip input; skip empty; break on "exit" case-insensitive).
  - Time the `process_grievance_text` call with `time.perf_counter()`,
    print latency in ms.
  - If the record is not None, print a formatted card showing:
    ID, Department, Category (issue_sub_category), Priority
    (urgency_priority), Risk Score (hazard_risk_score), Landmark
    (extracted_landmark), Action (action_required), and Suggested SMS
    Reply (suggested_sms_reply). Use a clear `=` divider layout.
- Bottom of file:
  ```python
  if __name__ == "__main__":
      interactive_cli()
  ```

### Exact JSON schema (for prompt_templates.py and validation)
```json
{
  "complaint_id": "INC-2026-0101",
  "raw_transcript": "string",
  "detected_language": "string",
  "department": "string",
  "issue_sub_category": "string",
  "extracted_landmark": "string",
  "urgency_priority": "P1-Emergency | P2-High | P3-Medium | P4-Low",
  "hazard_risk_score": 85,
  "action_required": "string",
  "suggested_sms_reply": "string"
}
```

## Step 3 — Verify
Run `python -m py_compile backend/backend_engine.py backend/prompt_templates.py`
and fix any syntax errors until it passes.

Do NOT run the CLI interactively (the .env key is empty). Do NOT commit
or push to git.

## Rules
- No placeholders, no TODOs, no fake values — all code must be complete
  and runnable.
- No comments except where strictly needed.
- Use only the three libraries in requirements.txt (plus stdlib).
- Report at the end: list of files created and the command the user
  runs to start the CLI.