# Pronto Nokia Ticket Management

Node.js and Express ticket management app with a PostgreSQL database.

## Run locally

1. Install Node.js 20 or later.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and `APP_ADMIN_EMAIL`.
3. Run `npm install` and `npm start`.
4. Open `http://localhost:3000/login.html` and create the initial admin password.

The database schema and starter part codes are created automatically when the app starts. The API uses server-side sessions and bcrypt password hashes. The initial admin account is restricted to `APP_ADMIN_EMAIL`; the password is chosen by the admin during first-time setup and is not stored in the repository.

## Render deployment

Create a PostgreSQL database and a Node web service connected to this repository. Set `DATABASE_URL` to the database's internal connection URL, and set `APP_ADMIN_EMAIL` to the email that will own the app. Use `npm install` as the build command and `npm start` as the start command. The service listens on Render's assigned `PORT`. On the first visit, create the admin password in the app; the password must be at least 14 characters.

Render's free PostgreSQL databases expire after 30 days. Use a paid database or another durable PostgreSQL provider for persistent production data.
