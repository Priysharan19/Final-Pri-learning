# Deploying the marking gateway to Cloud Run (Mumbai)

The gateway is the only part of Pri Learning that touches a network or holds a
secret. Everything else — questions, marking, progress, handwriting recognition
— runs on the student's device and keeps running when this is down.

Region is `asia-south1` (Mumbai) so student work stays in India, which is what
the DPDP Act expects of a service for Indian children.

## Once, per project

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
gcloud artifacts repositories create pri --repository-format=docker --location=asia-south1
```

## Secrets

Two, both required in production. The gateway refuses to boot without the
client token, because without it every route is an open proxy to your OpenAI
billing account.

```bash
printf '%s' "$OPENAI_API_KEY" | gcloud secrets create pri-openai-key --data-file=-
openssl rand -hex 32 | gcloud secrets create pri-client-token --data-file=-
```

Read the client token back — the app needs it:

```bash
gcloud secrets versions access latest --secret=pri-client-token
```

## Deploy

Run from the repository root, not from this directory: the Dockerfile copies
paths relative to the repo.

```bash
gcloud run deploy pri-marking \
  --source . \
  --dockerfile deploy/cloudrun/Dockerfile \
  --region asia-south1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 4 \
  --concurrency 20 \
  --cpu 1 --memory 512Mi \
  --timeout 60s \
  --set-env-vars 'NODE_ENV=production,PRI_CLOUD_ALLOWED_ORIGINS=https://app.prilearning.in' \
  --set-secrets 'OPENAI_API_KEY=pri-openai-key:latest,PRI_CLOUD_CLIENT_TOKEN=pri-client-token:latest'
```

`--allow-unauthenticated` is correct here and is not the same as unprotected:
Cloud Run's own IAM check is bypassed, and the gateway's bearer token plus its
per-client rate limits are what actually guard it. Students cannot hold Google
credentials, so the token is the only workable scheme.

`--max-instances 4` is a spend ceiling as much as a scaling one. Each instance
takes 20 concurrent requests; four is far more marking than a pilot generates,
and it caps what a runaway client can cost you before you notice.

## Point the apps at it

Take the service URL from the deploy output.

**Web build** — set before `npm run build`:

```bash
VITE_PRI_CLOUD_INK_ENDPOINT=https://pri-marking-xxxx.a.run.app/v1/handwriting/recognize
VITE_PRI_CLOUD_INK_TOKEN=the-client-token
```

**iPad app** — add both to `AppInfo.plist`, or set them at runtime in
`UserDefaults` under the same keys (see `CloudInkSettings.swift`):

```xml
<key>PriCloudInkEndpoint</key>
<string>https://pri-marking-xxxx.a.run.app/v1/handwriting/recognize</string>
<key>PriCloudInkToken</key>
<string>the-client-token</string>
```

Only the recognition endpoint is configured. The marking route is a sibling of
it and the client derives one from the other, so the two can never be pointed
at different hosts.

## Check it

```bash
curl -s https://pri-marking-xxxx.a.run.app/health | jq
```

`openaiConfigured: true` means a key is present in the process. It does not
mean the key works — the first real marking request is what proves billing,
quota and model access.

## What it costs

Cloud Run scales to zero, so the container itself is roughly free below a few
thousand requests a month. The real cost is the model, and the gateway is
deliberately not the thing that limits it — per-student entitlement belongs on
the device. What the gateway does is bound the damage:

| Control | Default | Env var |
| --- | --- | --- |
| Burst | 12 per minute per client | `PRI_CLOUD_RATE_BURST` |
| Daily | 400 per client | `PRI_CLOUD_RATE_DAILY` |

These are in-process and reset when the container does, which on scale-to-zero
is often. They exist to make a mistake survivable, not to be a billing system.
Put an API Gateway quota in front of this before a public launch.
