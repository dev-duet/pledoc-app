// functions/src/promptTemplates.ts
//
// Builds the single structured prompt sent to Gemini for each complaint.
// One call handles: transcript cleanup, language detection, translation,
// and structured field extraction (category, location, issue_summary).
// Keeping this prompt text separate from the pipeline logic in listener.ts
// so it can be iterated on without touching the Firestore/Gemini plumbing.

export interface ComplaintInput {
    transcript: string;
    language?: string; // language claimed/selected by citizen in the frontend, if any
    location?: {
        country?: string;
        state?: string;
        district?: string;
    };
}

export function buildIngestionPrompt(input: ComplaintInput): string {
    const { transcript, language, location } = input;

    return `You are an assistant that processes citizen infrastructure complaints for a government feedback platform (Pledoc). You will receive a raw transcript (which may be informal, colloquial, or contain speech-to-text errors) and must return ONLY a single valid JSON object — no markdown, no code fences, no explanation text before or after.

CITIZEN-PROVIDED CONTEXT:
- Transcript: """${transcript}"""
- Language selected in app (may be wrong or approximate): ${language ?? "unknown"}
- Location provided by citizen: ${location ? JSON.stringify(location) : "not provided"}

YOUR TASK — perform all of the following in this single response:
1. Clean up the transcript: fix obvious speech-to-text errors, remove filler words (um, uh, repeated words), but preserve the original meaning and all factual details. Do not invent details that weren't said.
2. Detect the actual language of the transcript (ISO 639-1 code, e.g. "hi", "en", "zh", "pt", "ru", "zu", "ar", "fa", "am"). This may differ from the app-selected language.
3. Translate the cleaned transcript into English (used internally for clustering/dashboard — the citizen-facing side of the app stays in their own language elsewhere).
4. Classify the complaint into exactly ONE category from this fixed list: "water", "roads", "electricity", "sanitation", "other". If it doesn't clearly fit the first four, use "other".
5. Extract a concise issue_summary in English: one or two plain sentences describing the problem, suitable for a policymaker dashboard. No speculation about causes or blame.
6. If the citizen mentioned any location detail not already captured in the provided location object (e.g. a specific street, landmark, or ward name), include it as location_detail; otherwise use null.

Respond with ONLY this JSON shape, valid and parseable, nothing else:
{
  "detected_language": string,
  "cleaned_transcript": string,
  "translated_transcript_en": string,
  "category": "water" | "roads" | "electricity" | "sanitation" | "other",
  "issue_summary": string,
  "location_detail": string | null
}`;
}