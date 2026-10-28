const express = require("express");
const session = require("express-session");
const path = require("path");
const { Pool } = require("pg");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const app = express();
const port = Number(process.env.PORT) || 3000;
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const adminEmail = (process.env.APP_ADMIN_EMAIL || "admin@pronto.com").trim().toLowerCase();
const sessionSecret = crypto.randomBytes(32).toString("hex");

if (!databaseUrl) {
  console.error("DATABASE_URL is required. Configure a PostgreSQL database before starting the app.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 10000
});

app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  if (["/server.js", "/package.json", "/package-lock.json", "/setup_database.sql"].includes(req.path) || req.path.startsWith("/node_modules/")) {
    return res.sendStatus(404);
  }
  next();
});
app.use(express.static(__dirname));
app.set("trust proxy", 1);
app.use(session({
  name: "pronto.sid",
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: "auto", sameSite: "lax", maxAge: 8 * 60 * 60 * 1000 }
}));

const schema = `
CREATE TABLE IF NOT EXISTS tickets (
  id BIGSERIAL PRIMARY KEY,
  intimate_date DATE,
  country VARCHAR(100),
  pronto_no VARCHAR(100) NOT NULL UNIQUE,
  part_code VARCHAR(100),
  unit_name VARCHAR(255),
  part_group VARCHAR(255),
  part_family VARCHAR(255),
  unit_version VARCHAR(100),
  serial_number VARCHAR(100),
  fault_description TEXT,
  owner_type VARCHAR(50),
  owner_name VARCHAR(255),
  created_by VARCHAR(255),
  priority VARCHAR(50) NOT NULL DEFAULT 'No Priority',
  rc_analysis_steps VARCHAR(50) NOT NULL DEFAULT 'Tracking',
  feedback_to_rd TEXT,
  rd_instructions_feedback_to_rc TEXT,
  component_replaced VARCHAR(255),
  final_summary TEXT,
  pronto_rca_analysis_status VARCHAR(50) NOT NULL DEFAULT 'Tracking',
  normal_repair_status VARCHAR(50) NOT NULL DEFAULT 'Visual Check',
  rca_end_date DATE,
  closed_date DATE,
  additional_remarks TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'Open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS part_codes (
  id BIGSERIAL PRIMARY KEY,
  part_code VARCHAR(100) NOT NULL UNIQUE,
  unit_name VARCHAR(255),
  part_group VARCHAR(255),
  part_family VARCHAR(255)
);
CREATE TABLE IF NOT EXISTS rd_owners (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255)
);
CREATE TABLE IF NOT EXISTS rc_owners (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255)
);
CREATE TABLE IF NOT EXISTS app_users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO part_codes (part_code, unit_name, part_group, part_family) VALUES
  ('PC1001', 'Base Station Unit A', 'RF Module', 'Macro Family'),
  ('PC1002', 'Base Station Unit B', 'Power Module', 'Macro Family'),
  ('PC1003', 'Small Cell Unit C', 'Antenna Module', 'Small Cell Family')
ON CONFLICT (part_code) DO NOTHING;
`;

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const requireLogin = (req, res, next) => {
  if (req.session.user) return next();
  res.status(401).json({ error: "Please log in to continue." });
};

const ownerTable = (value) => {
  if (value === "rd-owners") return "rd_owners";
  if (value === "rc-owners") return "rc_owners";
  return null;
};

app.get("/api/health", asyncRoute(async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ status: "ok" });
}));

async function startSession(req, res, user) {
  await new Promise((resolve, reject) => req.session.regenerate((err) => err ? reject(err) : resolve()));
  req.session.user = { email: user.email, role: user.role };
  await new Promise((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));
  res.json(req.session.user);
}

app.get("/api/auth/setup-status", asyncRoute(async (_req, res) => {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM app_users");
  res.json({ needsSetup: rows[0].count === 0 });
}));

app.post("/api/auth/setup", asyncRoute(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM app_users");
  if (rows[0].count !== 0) return res.status(409).json({ error: "The initial account has already been created. Please log in." });
  if (email !== adminEmail) return res.status(403).json({ error: "Use the configured admin email." });
  if (password.length < 14) return res.status(400).json({ error: "Choose a password with at least 14 characters." });
  const passwordHash = await bcrypt.hash(password, 12);
  const { rows: users } = await pool.query(
    "INSERT INTO app_users (email, password_hash, role) VALUES ($1, $2, 'admin') ON CONFLICT (email) DO NOTHING RETURNING email, role",
    [email, passwordHash]
  );
  if (!users[0]) return res.status(409).json({ error: "The initial account has already been created. Please log in." });
  await startSession(req, res, users[0]);
}));

app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const { rows } = await pool.query("SELECT email, password_hash, role FROM app_users WHERE email = $1", [email]);
  if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash))) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  await startSession(req, res, rows[0]);
}));

app.get("/api/auth/me", requireLogin, (req, res) => res.json(req.session.user));
app.post("/api/auth/logout", requireLogin, (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Could not log out." });
    res.clearCookie("pronto.sid", { httpOnly: true, secure: "auto", sameSite: "lax" });
    res.status(204).end();
  });
});

app.use("/api", (req, res, next) => {
  if (req.path === "/health" || req.path.startsWith("/auth/")) return next();
  return requireLogin(req, res, next);
});

app.get("/api/part-codes", asyncRoute(async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM part_codes ORDER BY part_code");
  res.json(rows);
}));

app.get("/api/part-codes/:code", asyncRoute(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM part_codes WHERE part_code = $1", [req.params.code]);
  if (!rows[0]) return res.status(404).json({ error: "Part code not found." });
  res.json(rows[0]);
}));

app.post("/api/part-codes", asyncRoute(async (req, res) => {
  const { partCode, unitName, partGroup, partFamily } = req.body;
  if (!String(partCode || "").trim()) return res.status(400).json({ error: "Part code is required." });
  const { rows } = await pool.query(
    "INSERT INTO part_codes (part_code, unit_name, part_group, part_family) VALUES ($1, $2, $3, $4) RETURNING *",
    [partCode.trim(), unitName || null, partGroup || null, partFamily || null]
  );
  res.status(201).json(rows[0]);
}));

app.delete("/api/part-codes/:id", asyncRoute(async (req, res) => {
  const result = await pool.query("DELETE FROM part_codes WHERE id = $1", [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: "Part code not found." });
  res.status(204).end();
}));

app.get("/api/:kind", asyncRoute(async (req, res, next) => {
  const table = ownerTable(req.params.kind);
  if (!table) return next();
  const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY name`);
  res.json(rows);
}));

app.post("/api/:kind", asyncRoute(async (req, res, next) => {
  const table = ownerTable(req.params.kind);
  if (!table) return next();
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Name is required." });
  const { rows } = await pool.query(`INSERT INTO ${table} (name, email) VALUES ($1, $2) RETURNING *`, [name, req.body.email || null]);
  res.status(201).json(rows[0]);
}));

app.delete("/api/:kind/:id", asyncRoute(async (req, res, next) => {
  const table = ownerTable(req.params.kind);
  if (!table) return next();
  const result = await pool.query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: "Owner not found." });
  res.status(204).end();
}));

app.get("/api/tickets/closed", asyncRoute(async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM tickets WHERE status = 'Closed' ORDER BY created_at DESC");
  res.json(rows);
}));

app.get("/api/tickets", asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    req.query.all === "true"
      ? "SELECT * FROM tickets ORDER BY created_at DESC"
      : "SELECT * FROM tickets WHERE status <> 'Closed' ORDER BY created_at DESC"
  );
  res.json(rows);
}));

app.post("/api/tickets", asyncRoute(async (req, res) => {
  const b = req.body;
  const prontoNo = String(b.prontoNo || "").trim();
  if (!prontoNo) return res.status(400).json({ error: "Pronto number is required." });
  const columns = ["intimate_date", "country", "pronto_no", "part_code", "unit_name", "part_group", "part_family", "unit_version", "serial_number", "fault_description", "owner_type", "owner_name", "created_by"];
  const values = [b.intimateDate, b.country, prontoNo, b.partCode, b.unitName, b.partGroup, b.partFamily, b.unitVersion, b.serialNumber, b.faultDescription, b.ownerType, b.ownerName, b.createdBy];
  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const { rows } = await pool.query(`INSERT INTO tickets (${columns.join(", ")}) VALUES (${placeholders}) RETURNING id`, values);
  res.status(201).json({ id: rows[0].id });
}));

app.get("/api/tickets/:id", asyncRoute(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM tickets WHERE id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Ticket not found." });
  res.json(rows[0]);
}));

app.put("/api/tickets/:id", asyncRoute(async (req, res) => {
  const b = req.body;
  const columns = ["intimate_date", "country", "pronto_no", "part_code", "unit_name", "owner_type", "owner_name", "priority", "rc_analysis_steps", "feedback_to_rd", "rd_instructions_feedback_to_rc", "component_replaced", "final_summary", "pronto_rca_analysis_status", "normal_repair_status", "rca_end_date", "additional_remarks", "status"];
  const values = [b.intimateDate, b.country, b.prontoNo, b.partCode, b.unitName, b.ownerType, b.ownerName, b.priority, b.rcAnalysisSteps, b.feedbackToRd, b.rdInstructionsFeedbackToRc, b.componentReplaced, b.finalSummary, b.prontoRcaAnalysisStatus, b.normalRepairStatus, b.rcaEndDate || null, b.additionalRemarks, b.status === "Closed" ? "Closed" : "Open"];
  const setters = columns.map((column, index) => `${column} = $${index + 1}`);
  setters.push(`closed_date = CASE WHEN $18 = 'Closed' THEN COALESCE($16::date, CURRENT_DATE) ELSE NULL END`);
  values.push(req.params.id);
  const { rows } = await pool.query(`UPDATE tickets SET ${setters.join(", ")} WHERE id = $19 RETURNING *`, values);
  if (!rows[0]) return res.status(404).json({ error: "Ticket not found." });
  res.json(rows[0]);
}));

app.delete("/api/tickets/:id", asyncRoute(async (req, res) => {
  const result = await pool.query("DELETE FROM tickets WHERE id = $1", [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: "Ticket not found." });
  res.status(204).end();
}));

app.get("/api/dashboard/summary", asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status <> 'Closed')::int AS open_count,
      COUNT(*) FILTER (WHERE status = 'Closed')::int AS closed_count
    FROM tickets
  `);
  res.json(rows[0]);
}));

app.get("/api/dashboard/status-summary", asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT COUNT(*) FILTER (WHERE status = 'Open')::int AS opened,
      COUNT(*) FILTER (WHERE status = 'In Progress')::int AS in_progress,
      COUNT(*) FILTER (WHERE status = 'Closed')::int AS closed
    FROM tickets
  `);
  res.json(rows[0]);
}));

app.get("/api/dashboard/monthly-status-summary", asyncRoute(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = req.query.month === "all" ? null : Number(req.query.month) || null;
  const { rows } = await pool.query(`
    SELECT TO_CHAR(date_trunc('month', created_at), 'Mon') AS month_label,
      EXTRACT(MONTH FROM created_at)::int AS month_number,
      COUNT(*) FILTER (WHERE status = 'Open')::int AS opened,
      COUNT(*) FILTER (WHERE status = 'In Progress')::int AS in_progress,
      COUNT(*) FILTER (WHERE status = 'Closed')::int AS closed
    FROM tickets
    WHERE EXTRACT(YEAR FROM created_at) = $1 AND ($2::int IS NULL OR EXTRACT(MONTH FROM created_at) = $2)
    GROUP BY date_trunc('month', created_at), EXTRACT(MONTH FROM created_at)
    ORDER BY month_number
  `, [year, month]);
  res.json(rows);
}));

app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.use((err, _req, res, _next) => {
  console.error("Request failed:", err.message);
  if (err.code === "23505") return res.status(409).json({ error: "That value already exists." });
  if (err.code === "22P02" || err.code === "22007") return res.status(400).json({ error: "Invalid value." });
  res.status(500).json({ error: "Server error. Please try again." });
});

async function start() {
  await pool.query(schema);
  const server = app.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
  const shutdown = () => server.close(() => pool.end().finally(() => process.exit(0)));
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch((err) => {
  console.error("Could not initialize the database:", err.message);
  process.exit(1);
});
