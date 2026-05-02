# Knowledge Hub

## Prerequisites

- Git - [Download & Install Git](https://git-scm.com/downloads).
- Node.js - [Download & Install Node.js](https://nodejs.org/en/download/) and the npm package manager.

## Downloading

```
git clone https://github.com/zhannach/nodejs-2026q1-knowledge-hub.git
```

## Installing NPM modules

```
npm install
```

## Gemini AI setup

This project integrates Google Gemini through direct HTTP API calls and uses
`gemini-2.0-flash` by default.

### Get a Gemini API key

1. Open [Google AI Studio](https://aistudio.google.com/).
2. Sign in with a Google account.
3. Open **Get API key**.
4. Create a key in a new or existing Google Cloud project.
5. Copy the generated key.

### Configure environment variables

Copy `.env.example` to `.env` and paste your key into `GEMINI_API_KEY`:

```
GEMINI_API_KEY=your-gemini-api-key
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com
GEMINI_MODEL=gemini-2.0-flash
AI_RATE_LIMIT_RPM=20
AI_CACHE_TTL_SEC=300
```

`AI_RATE_LIMIT_RPM` controls the maximum number of AI requests per minute per
client. `AI_CACHE_TTL_SEC` controls the in-memory cache lifetime for summarize
and translate responses.

## Run application locally with Docker

```
docker-compose up --build
```

After starting the app on port (4000 as default) you can open
in your browser OpenAPI documentation by typing http://localhost:4000/doc/.
For more information about OpenAPI/Swagger please visit https://swagger.io/.

### Test AI endpoints

Create or reuse an article ID, then call the AI endpoints:

```
curl -X POST http://localhost:4000/ai/articles/<articleId>/summarize \
  -H "Content-Type: application/json" \
  -d '{"maxLength":"medium"}'
```

```
curl -X POST http://localhost:4000/ai/articles/<articleId>/translate \
  -H "Content-Type: application/json" \
  -d '{"targetLanguage":"Ukrainian"}'
```

```
curl -X POST http://localhost:4000/ai/articles/<articleId>/analyze \
  -H "Content-Type: application/json" \
  -d '{"task":"review"}'
```

Optional generic generation:

```
curl -X POST http://localhost:4000/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Write a short onboarding tip for Knowledge Hub users."}'
```

Usage since startup is available at:

```
curl http://localhost:4000/ai/usage
```

Known limitations: Gemini free-tier quotas can return upstream rate limits,
responses may have noticeable latency, and availability can vary by region or
Google account/project configuration. Cached AI responses are stored only in
memory and are lost when the service restarts.

## Testing

After application running open new terminal and enter:

To run all tests without authorization

```
npm run test
```

To run only one of all test suites

```
npm run test -- <path to suite>
```

To run all test with authorization

```
npm run test:auth
```

To run only specific test suite with authorization

```
npm run test:auth -- <path to suite>
```

To run refresh token tests

```
npm run test:refresh
```

To run RBAC (role-based access control) tests

```
npm run test:rbac
```

### Auto-fix and format

```
npm run lint
```

```
npm run format
```

### Debugging in VSCode

Press <kbd>F5</kbd> to debug.

For more information, visit: https://code.visualstudio.com/docs/editor/debugging

## Docker Hub

Application image is available on Docker Hub: [zhanna/knowledge-hub-app](https://hub.docker.com/r/zhannach/knowledge-hub-app)

## Check that seed script is implemented and runnable via npx prisma db seed

npx prisma studio
