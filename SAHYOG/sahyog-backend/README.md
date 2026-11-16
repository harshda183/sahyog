# SAHYOG backend (MongoDB version)

## Requirements
- Node.js 18 or newer
- npm
- A MongoDB Atlas cluster (or local MongoDB server)

## Configure MongoDB
1. In MongoDB Atlas, create a free cluster and a database user.
2. In Network Access, allow your current IP address for development.
3. Copy the Node.js connection string from Atlas.
4. In this folder, copy `.env.example` to `.env`.
5. Replace the placeholder `MONGODB_URI` with your connection string. Replace `<password>` with the database user's password (URL-encode special characters if needed).
6. Never upload or share your real `.env` file or database password.

## Run backend
```bash
npm install
npm run dev
```

Backend: `http://localhost:5000`
Health check: `http://localhost:5000/api/health`

## MongoDB collections
- `users`: account name, email and salted password hash
- `courses`: course catalogue (seeded automatically on first start)
- `progresses`: each learner's progress for each course
- `feedbacks`: feedback submitted by a learner
- `checklists`: each learner's accessibility checklist answers

The existing frontend API routes and response shapes are retained. Course progress is stored separately per learner rather than shared between all learners. The session token is still held in backend memory for this demo, so restarting the backend logs users out; persistent login sessions can be added later.
