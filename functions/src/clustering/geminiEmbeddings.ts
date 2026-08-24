import { GEMINI_EMBED_URL } from "./config";

/**
 * Reads the Gemini API key from the environment. Your teammate holds this
 * key (she uses it for the Track A Gemini pipeline) — ask her to share it
 * directly, then set it as an env var before running the clustering watcher:
 *
 *   PowerShell: $env:GEMINI_API_KEY="her-key-here"
 *   Mac/Linux:  export GEMINI_API_KEY="her-key-here"
 *
 * Sharing it directly within your own team project is fine per the brief —
 * this isn't a security boundary between you two, just a "who's holding the
 * key" logistics thing.
 */
function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. Get the key from your teammate and set it as an environment variable before running the clustering watcher."
    );
  }
  return key;
}

/**
 * Generates an embedding vector for a piece of text via the Gemini
 * text-embedding-004 API. Throws on failure — callers should NOT silently
 * treat a failed embedding as "no similarity" or auto-create a new cluster,
 * since that could fragment what should be one cluster. Let it bubble up
 * so the watcher logs it and retries on the next relevant Firestore change.
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = getApiKey();

  const res = await fetch(GEMINI_EMBED_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text }] },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini embedding request failed with status ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { embedding?: { values: number[] } };
  if (!data.embedding?.values) {
    throw new Error("Gemini embedding response missing expected embedding.values field.");
  }

  return data.embedding.values;
}
