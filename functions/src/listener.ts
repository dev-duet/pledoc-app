// functions/src/listener.ts
//
// Standalone Node script (NOT a deployed Cloud Function) that watches the
// `complaints` collection for newly-created documents and runs them through
// the Gemini ingestion pipeline: transcript cleanup, language detection,
// translation, and structured field extraction.
//
// WHY A SCRIPT INSTEAD OF A CLOUD FUNCTION:
// Firestore-triggered Cloud Functions require the Blaze billing plan, which
// isn't set up yet. This script does the same job using the Firebase Admin
// SDK's realtime listener (onSnapshot) instead of a deployed onDocumentCreated
// trigger. It only reacts to complaints created after the script starts —
// same behavior a real onCreate trigger would have (it wouldn't fire on
// pre-existing docs either). Migrating to a real Cloud Function later is a
// small wrapper change; the Gemini logic below stays the same either way.
//
// SETUP (see README notes at bottom of this file):
//   1. npm install @google/genai dotenv
//   2. npm install -D ts-node
//   3. Create functions/.env with GEMINI_API_KEY=your-key-here
//   4. Make sure functions/service-account.json exists (gitignored)
//   5. Run with: npm run listen   (after adding the script to package.json)

import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
import * as path from "path";
import { buildIngestionPrompt } from "./promptTemplates";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error(
        "Missing GEMINI_API_KEY. Create functions/.env with a line: GEMINI_API_KEY=your-key-here"
    );
    process.exit(1);
}

// --- Firebase Admin setup ---
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!serviceAccountJson) {
    console.error(
        "Missing FIREBASE_SERVICE_ACCOUNT_JSON. Set it as an environment variable containing the full service account JSON."
    );
    process.exit(1);
}
admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAcoountJson)),
});
const db = admin.firestore();

// --- Gemini client setup ---
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const MODEL_NAME = "gemini-3.6-flash";

// Simple in-memory cooldown so a Gemini outage/rate-limit doesn't cause this
// script to hammer the same doc in a tight retry loop while it's running.
const failureCache = new Map<string, number>(); // docId -> last failure timestamp
const RETRY_COOLDOWN_MS = 60_000;

interface GeminiResult {
    detected_language: string;
    cleaned_transcript: string;
    translated_transcript_en: string;
    category: "water" | "roads" | "electricity" | "sanitation" | "other";
    issue_summary: string;
    location_detail: string | null;
}

function extractJson(rawText: string): GeminiResult {
    // Gemini can sometimes wrap JSON in code fences despite instructions —
    // strip those defensively before parsing.
    const cleaned = rawText
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/, "")
        .trim();

    const parsed = JSON.parse(cleaned);

    const validCategories = ["water", "roads", "electricity", "sanitation", "other"];
    if (!validCategories.includes(parsed.category)) {
        parsed.category = "other";
    }
    return parsed as GeminiResult;
}

const CATEGORY_MAP: Record<string, "Water" | "Roads" | "Electricity" | "Sanitation" | "Other"> = {
    water: "Water",
    roads: "Roads",
    electricity: "Electricity",
    sanitation: "Sanitation",
    other: "Other",
};

async function processComplaint(
    docId: string,
    data: FirebaseFirestore.DocumentData
): Promise<void> {
    const docRef = db.collection("complaints").doc(docId);

    const lastFailure = failureCache.get(docId);
    if (lastFailure && Date.now() - lastFailure < RETRY_COOLDOWN_MS) {
        console.log(`Skipping ${docId} — still in retry cooldown after a previous failure.`);
        return;
    }

    // Use transcript if available (voice mode), or issue_summary (text mode)
    const rawContent = data.transcript || data.issue_summary || "";

    const prompt = buildIngestionPrompt({
        transcript: rawContent,
        language: data.language,
        location: data.location,
    });

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
        });

        const rawText = response.text ?? "";
        const result = extractJson(rawText);

        // Normalize category to Title Case matching frontend types
        const normalizedCategory =
            CATEGORY_MAP[result.category?.toLowerCase()] || data.category || "Other";

        await docRef.update({
            category: normalizedCategory,
            issue_summary: result.issue_summary || data.issue_summary || "",
            transcript: data.transcript ? result.cleaned_transcript : null,
            language: result.detected_language || data.language || "en",
            translated_transcript_en: result.translated_transcript_en || "",
            location_detail: result.location_detail || null,
            processing_status: "processed",
            processed_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        failureCache.delete(docId);
        console.log(`Processed complaint ${docId} -> category: ${normalizedCategory}`);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Failed to process complaint ${docId}:`, message);
        failureCache.set(docId, Date.now());

        // Fallback: don't let the complaint sit silently unprocessed. Mark it
        // clearly so /status and the dashboard show a real state instead of a
        // blank/stuck record, and so it's obvious this doc needs re-attention
        // (either an automatic retry pass later, or manual review).
        await docRef
            .update({
                processing_status: "processing_failed",
                processing_error: message,
                verification_status: "needs_review",
            })
            .catch((updateErr) => {
                // If even the fallback write fails (permissions, network blip),
                // log loudly rather than throwing — one bad doc shouldn't kill the
                // whole listener process.
                console.error(`Also failed to write fallback status for ${docId}:`, updateErr);
            });
    }
}

// --- Listen for new complaints created from this point forward ---
const startedAt = Date.now();
console.log(`Listening for new complaints created after ${new Date(startedAt).toISOString()}...`);

db.collection("complaints")
    .where("created_at", ">", startedAt)
    .onSnapshot(
        (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    processComplaint(change.doc.id, change.doc.data());
                }
            });
        },
        (err) => {
            console.error("Listener error (connection to Firestore lost?):", err);
        }
    );

// Keep the process alive — onSnapshot runs in the background, but Node will
// exit if nothing else is scheduled. This script is meant to be left running
// in a terminal for as long as you're testing/demoing.
process.stdin.resume();
console.log("Listener running. Press Ctrl+C to stop.");
