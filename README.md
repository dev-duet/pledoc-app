# Pledoc

Multilingual citizen feedback platform for BRICS nations. Citizens report
infrastructure gaps (water, roads, electricity, sanitation) by voice or text
in their own language; AI verifies, clusters and prioritizes the reports
for policymakers.

## Links
- Live site: https://pledoc-app.web.app
- Repository: https://github.com/dev-duet/pledoc-app
- Demo video: <paste link>

## How the backend runs
The frontend (React + Vite + TypeScript) is hosted on Firebase, with
Firestore as the database. Because the Firebase Spark plan doesn't allow
deployed Cloud Function triggers, the backend runs as one persistent
Node.js service on Railway, deployed from this repo. It runs three
Firestore `onSnapshot` watchers in a single process:

1. **Ingestion (Gemini):** on every new complaint, one structured Gemini
   call detects the language, translates to English, and extracts the
   category and issue summary. Failed calls (503 or rate limits) are
   retried every 2 minutes, then flagged for manual review, so the
   pipeline never dies silently.
2. **Clustering:** groups complaints by category and location bucket,
   then merges near-duplicates using Gemini embedding similarity.
3. **Geo-verification and prioritization:** cross-checks each cluster
   against OpenStreetMap (Overpass), applies auto-resolution rules,
   computes a priority score, and cascades status and score to every
   linked complaint.

When a policymaker verifies or invalidates a cluster on the dashboard,
that decision cascades to each complaint, so a citizen can look up their
complaint ID on `/status` and see the outcome.

## Hosting note (trial credit)
The Railway backend runs on Railway's free trial credit (about $4.60,
27 days remaining as of Sept 30, 2026). If the credit has run out when
you read this, new submissions are still saved to Firestore but are not
processed until the service is restarted with credit. The frontend and
stored data are unaffected. In production, the backend would move to
Cloud Functions on the Blaze plan.
