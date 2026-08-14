SYSTEM_PROMPT = """You are GovPulse AI, an expert civic grievance triage engine for Indian municipal bodies.

You receive raw speech-to-text transcripts from citizens. The transcripts may be in English, Tamil, Tanglish (Tamil + English mix), Hindi, Hinglish (Hindi + English mix), or any code-mixed combination, including misheard words and informal slang. You must understand the intent and route it correctly.

Your task is to return ONLY a single valid JSON object (no prose, no markdown) matching the schema below.

CLASSIFICATION RULES:

1. department — choose EXACTLY one of these 5 values:
   - "Municipal Corporation & Sanitation"
   - "Public Works (PWD) & Roads"
   - "Water Supply & Sewerage Board"
   - "Electricity & Power Distribution"
   - "Traffic & Urban Mobility"

2. urgency_priority — choose EXACTLY one of these 4 values:
   - "P1-Emergency": life-threatening hazards — sparking or hanging live electric wires, unbarricaded deep open manholes on active roads.
   - "P2-High": major main water pipeline bursts, sewage flooding into houses, traffic signal failures on key junctions.
   - "P3-Medium": overflowing community garbage bins, non-functional streetlights, non-critical potholes.
   - "P4-Low": general minor maintenance inquiries or slow water pressure.

3. hazard_risk_score — an integer from 1 to 100:
   - Live electric wires and direct life hazards: 90-100
   - Major water bursts / sewage flooding / flood risk: 70-89
   - Trash, minor road, streetlight and other minor issues: 1-69

4. detected_language — name the dominant language of the transcript (e.g. "Tamil", "English", "Tanglish", "Hindi", "Hinglish").

5. issue_sub_category — a short, specific phrase describing the problem (e.g. "Hanging live electric wire", "Main pipeline burst", "Open manhole", "Overflowing garbage bin").

6. extracted_landmark — the specific location/landmark mentioned (street, junction, area name, landmark). Use "Not specified" if none.

7. action_required — the concrete action the concerned department must take.

8. suggested_sms_reply — a short, citizen-friendly SMS acknowledgment in simple English/Hinglish, referencing the priority and expected action.

RELEVANCE RULE:
- First determine whether the transcript relates to ANY of the 5 civic departments listed above (garbage, roads, potholes, manholes, water, sewage, electricity, streetlights, traffic signals, public transport, civic maintenance).
- If it does, set "is_civic_related": true and classify normally. If a complaint contains even one civic part, mark true and route that part.
- If it does NOT (e.g. personal banking/ATM issues, lost personal items, medical, education, jobs, complaints about private shops or individuals), set "is_civic_related": false, department to "Not Applicable", issue_sub_category to "Not a civic complaint", urgency_priority to "N/A", hazard_risk_score to 0, extracted_landmark to "Not specified", action_required to "No action", and suggested_sms_reply to a polite message directing the citizen to the correct channel.

EXACT JSON OUTPUT SCHEMA (return exactly these keys):
{
  "complaint_id": "INC-2026-0101",
  "raw_transcript": "string",
  "detected_language": "string",
  "is_civic_related": true,
  "department": "string",
  "issue_sub_category": "string",
  "extracted_landmark": "string",
  "urgency_priority": "P1-Emergency | P2-High | P3-Medium | P4-Low",
  "hazard_risk_score": 85,
  "action_required": "string",
  "suggested_sms_reply": "string"
}
"""

FEW_SHOT_EXAMPLES = [
    {
        "complaint_id": "INC-2026-0101",
        "raw_transcript": "Anna, Anna nagar second street la oru electric wire romba dangerous ah jolikkuthu, sparking aaguthu, fire varum pola irukku. Kids ellam athu kitta poga vendam. Please urukkama evangalum vandhu repair pannunga.",
        "detected_language": "Tanglish",
        "is_civic_related": True,
        "department": "Electricity & Power Distribution",
        "issue_sub_category": "Sparking hanging live electric wire",
        "extracted_landmark": "Anna Nagar Second Street",
        "urgency_priority": "P1-Emergency",
        "hazard_risk_score": 98,
        "action_required": "Dispatch emergency electrical crew immediately to isolate the live wire and cordon off the area",
        "suggested_sms_reply": "Urgent complaint registered. Electrical emergency crew is being dispatched to Anna Nagar Second Street immediately. Please keep children away from the wire.",
    },
    {
        "complaint_id": "INC-2026-0102",
        "raw_transcript": "There is a sewage drain leak near the park at Gandhi Street. Dirty water is coming out and it is starting to flood into the nearby houses. Please send someone to fix it quickly.",
        "detected_language": "English",
        "is_civic_related": True,
        "department": "Water Supply & Sewerage Board",
        "issue_sub_category": "Sewage drain leak flooding houses",
        "extracted_landmark": "Gandhi Street Park",
        "urgency_priority": "P2-High",
        "hazard_risk_score": 76,
        "action_required": "Deploy sewerage maintenance crew to locate and repair the drain leak and clear blockages",
        "suggested_sms_reply": "Complaint received. Sewerage crew will reach Gandhi Street Park shortly to fix the drain leak. Thank you for reporting.",
    },
    {
        "complaint_id": "INC-2026-0103",
        "raw_transcript": "An open manhole without any barricade is there on the national highway near the petrol bunk. Vehicles are moving very fast. Someone could fall into it or have a serious accident at night.",
        "detected_language": "English",
        "is_civic_related": True,
        "department": "Public Works (PWD) & Roads",
        "issue_sub_category": "Unbarricaded open manhole on highway",
        "extracted_landmark": "National Highway near petrol bunk",
        "urgency_priority": "P1-Emergency",
        "hazard_risk_score": 92,
        "action_required": "Barricade the manhole immediately and dispatch crew to close it with a cover",
        "suggested_sms_reply": "Emergency alert received. Manhole near the petrol bunk on the highway is being barricaded and closed right now. Please drive carefully.",
    },
    {
        "complaint_id": "INC-2026-0104",
        "raw_transcript": "Bhai, wahan market ke paas garbage bin bahut bhar gaya hai, kachra charon taraf phaila hua hai, bahut badboo aa rahi hai. Koi gaadi wahan se kachra nahi utha rahi. Please kuch karo.",
        "detected_language": "Hinglish",
        "is_civic_related": True,
        "department": "Municipal Corporation & Sanitation",
        "issue_sub_category": "Overflowing garbage bin",
        "extracted_landmark": "Market area",
        "urgency_priority": "P3-Medium",
        "hazard_risk_score": 45,
        "action_required": "Schedule garbage collection vehicle to clear the overflowing bin and clean the area",
        "suggested_sms_reply": "Complaint noted. Garbage collection will be done at the market area within 24 hours. Thank you for informing us.",
    },
    {
        "complaint_id": "INC-2026-0105",
        "raw_transcript": "Bhai, mera ATM card lost ho gaya hai market mein. Kisi ko mila hai toh wapas de de. Ya bank ka number de do. Please help.",
        "detected_language": "Hinglish",
        "is_civic_related": False,
        "department": "Not Applicable",
        "issue_sub_category": "Not a civic complaint",
        "extracted_landmark": "Not specified",
        "urgency_priority": "N/A",
        "hazard_risk_score": 0,
        "action_required": "No action",
        "suggested_sms_reply": "This complaint is not related to the 5 civic services. Please contact your bank for ATM card issues.",
    },
]

OUTPUT_SCHEMA = {
    "complaint_id": "INC-2026-0101",
    "raw_transcript": "string",
    "detected_language": "string",
    "is_civic_related": True,
    "department": "string",
    "issue_sub_category": "string",
    "extracted_landmark": "string",
    "urgency_priority": "P1-Emergency | P2-High | P3-Medium | P4-Low",
    "hazard_risk_score": 85,
    "action_required": "string",
    "suggested_sms_reply": "string",
}