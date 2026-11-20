# NexaFlow

NexaFlow means **Next-generation workflow management**. It is a MERN app with invitation-based accounts, a shared workspace with role-based access, projects, tasks, team and calendar features, project activity and files, persistent notifications, and saved appearance preferences.

## Project structure

- `client/` — React + Vite frontend
- `server/` — Express API, Mongoose models, and routes

## Run locally

Requires Node.js 20+ and a MongoDB database.

1. Install frontend dependencies from `client/` with `npm install`, then start it with `npm run dev`.
2. In another terminal, install backend dependencies from `server/` with `npm install`.
3. Copy `server/.env.example` to `server/.env` and set `MONGODB_URI` to a MongoDB database you control.
4. Start the API from `server/` with `npm run dev`.

The frontend checks `VITE_API_URL` for the API base URL; it defaults to `http://localhost:5000`. Sessions use an HttpOnly cookie.

### Workspace access and roles

On the first API startup, the migration creates the shared **Acme Workspace**, moves existing projects, tasks, calendar events, and team records into it, and promotes the earliest existing account to Administrator if no administrator is present. Existing records are preserved. Existing accounts become workspace members. The first account in a new workspace becomes its Administrator; subsequent registrations require a workspace invitation.

Administrators manage workspace roles, members, and invitations. Project Managers can manage projects and invite Team Members. Team Members can view workspace data and update the status of tasks assigned to their account. Project deletion is blocked while tasks or files remain attached.

### Email and notifications

The app stores in-app assignment, project-update, and due-date notifications. Account email alerts, invitations, assignment/project emails, and weekly summaries require SMTP configuration. Set `SMTP_HOST`, `SMTP_PORT`, optional paired `SMTP_USER`/`SMTP_PASS`, and `EMAIL_FROM` in `server/.env`. For Gmail, use `smtp.gmail.com:587`, your Gmail address as `SMTP_USER`, and a Google App Password as `SMTP_PASS` (not your normal Gmail password). Keep SMTP credentials private. Delivery failures are logged and do not block account registration or login. Due-date reminders run every 15 minutes for tasks due tomorrow UTC and catch up tasks due today if the API resumes during their due date. Reminders are deduplicated per task, assignee, and due date. Weekly summaries are sent once per UTC week.

### Project file storage

Project files require a private S3-compatible bucket. Set `S3_BUCKET` and `S3_REGION`; `S3_ENDPOINT` is optional for compatible providers, and `S3_FORCE_PATH_STYLE=true` may be needed for some endpoints. Credentials can be provided with `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` or the AWS SDK's standard credential chain. Do not commit credentials.

Configure bucket CORS to allow the exact frontend origin in `CLIENT_URL`, `PUT` and `GET` methods, and headers used by signed requests (using `AllowedHeaders: ["*"]` is suitable for the app). Keep the bucket private; the API issues short-lived signed URLs. The app allows supported document/image types up to 25 MB.

## Deploy

### Vercel frontend

Import the GitHub repository as a Vercel project and set the **Root Directory** to `client`. Vercel should detect Vite; use `npm run build` and `dist` if prompted. Add `VITE_API_URL` with the public URL of the Render API (for example, `https://your-service.onrender.com`) and redeploy after setting it.

### Render backend

Create a **Web Service** from this GitHub repository and set **Root Directory** to `server`, **Build Command** to `npm install`, and **Start Command** to `npm start`. Add these environment variables in Render:

- `MONGODB_URI` — your MongoDB connection string
- `CLIENT_URL` — the deployed Vercel site origin (no trailing slash)
- `NODE_ENV` — `production`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` — SMTP settings for email alerts and invitations
- `S3_BUCKET` and `S3_REGION` — required for project file storage; optionally configure `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`

Render provides `PORT` automatically. The API health check is `GET /api/health`. Authentication endpoints are `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/profile`, `PUT /api/auth/preferences`, `PUT /api/auth/password`, and `POST /api/auth/logout`. Invitations are managed under `/api/team/invitations`; project, task, team, calendar, notification, activity, and file APIs are under `/api/projects`, `/api/tasks`, `/api/team`, `/api/events`, and `/api/notifications`. Protected endpoints require a valid session and enforce workspace membership and role permissions. In production, the API sets secure cross-site cookies, so configure `CLIENT_URL` to the exact frontend origin.
