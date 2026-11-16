# SAHYOG – React frontend + Express backend + MongoDB database

The React frontend remains unchanged. The Express backend stores users, courses, learner progress, feedback and accessibility checklist data in MongoDB.

## Start the backend
See `sahyog-backend/README.md` to configure MongoDB Atlas and create the backend `.env` file. Then run `npm install` and `npm run dev` inside `sahyog-backend`.

## Start the frontend
Open a second terminal in `sahyog-frontend` and run:

```bash
npm install
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`).

Do not commit or share your `.env` file or MongoDB password.
