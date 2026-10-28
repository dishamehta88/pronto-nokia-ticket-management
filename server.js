const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get(["/", "/index.html"], (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

function normalizeStatus(status) {
    const value = (status || "").toString().trim();
    if (!value) return "Open";

    const normalized = value.toLowerCase();
    if (normalized === "closed") return "Closed";
    if (normalized === "in progress" || normalized === "inprogress" || normalized === "in_progress") return "In Progress";
    return value;
}

function isClosedStatus(status) {
    return normalizeStatus(status) === "Closed";
}

function isAdminRequest(req) {
    const role = (req.headers["x-user-role"] || "").toString().trim().toLowerCase();
    return role === "admin";
}

function getCurrentDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function normalizeDateValue(value) {
    if (!value) return null;
    if (value instanceof Date) {
        const year = value.getUTCFullYear();
        const month = String(value.getUTCMonth() + 1).padStart(2, "0");
        const day = String(value.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed ? trimmed.split("T")[0] : null;
    }
    return value;
}

function serializeTicket(ticket) {
    if (!ticket || typeof ticket !== "object") return ticket;

    return {
        ...ticket,
        intimate_date: normalizeDateValue(ticket.intimate_date),
        rca_end_date: normalizeDateValue(ticket.rca_end_date),
        closed_date: normalizeDateValue(ticket.closed_date)
    };
}

function serializeTickets(rows) {
    return rows.map(serializeTicket);
}

// ---------------------------------------------------------
// DATABASE CONNECTION
// Update these values if your MySQL setup is different.
// ---------------------------------------------------------
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Disha@123",
    database: "pronto_db"
});

function initializeDatabase() {
    db.connect((err) => {
        if (err) {
            console.error("MySQL connection failed:", err);
            process.exit(1);
            return;
        }

        console.log("MySQL Connected Successfully");

        db.query("CREATE DATABASE IF NOT EXISTS pronto_db", (err) => {
            if (err) {
                console.error("Failed to create/verify database:", err);
                process.exit(1);
                return;
            }

            db.query("USE pronto_db", (err) => {
                if (err) {
                    console.error("Failed to select database:", err);
                    process.exit(1);
                    return;
                }

                const statements = [
                    `CREATE TABLE IF NOT EXISTS tickets (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        intimate_date DATE,
                        country VARCHAR(100),
                        pronto_no VARCHAR(100) NOT NULL,
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
                        priority VARCHAR(50) DEFAULT 'No Priority',
                        rc_analysis_steps VARCHAR(50) DEFAULT 'Tracking',
                        feedback_to_rd TEXT,
                        rd_instructions_feedback_to_rc TEXT,
                        component_replaced VARCHAR(255),
                        final_summary TEXT,
                        pronto_rca_analysis_status VARCHAR(50) DEFAULT 'Tracking',
                        normal_repair_status VARCHAR(50) DEFAULT 'Visual Check',
                        rca_end_date DATE,
                        closed_date DATE,
                        additional_remarks TEXT,
                        status VARCHAR(50) DEFAULT 'Open',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )`,
                    `CREATE TABLE IF NOT EXISTS part_codes (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        part_code VARCHAR(100) NOT NULL UNIQUE,
                        unit_name VARCHAR(255),
                        part_group VARCHAR(255),
                        part_family VARCHAR(255)
                    )`,
                    `CREATE TABLE IF NOT EXISTS rd_owners (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        email VARCHAR(255)
                    )`,
                    `CREATE TABLE IF NOT EXISTS rc_owners (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        email VARCHAR(255)
                    )`,
                    `INSERT INTO part_codes (part_code, unit_name, part_group, part_family)
                     VALUES
                        ('PC1001', 'Base Station Unit A', 'RF Module', 'Macro Family'),
                        ('PC1002', 'Base Station Unit B', 'Power Module', 'Macro Family'),
                        ('PC1003', 'Small Cell Unit C', 'Antenna Module', 'Small Cell Family')
                     ON DUPLICATE KEY UPDATE part_code = part_code`
                ];

                const columnStatements = [
                    { name: "priority", sql: "ALTER TABLE tickets ADD COLUMN priority VARCHAR(50) DEFAULT 'No Priority'" },
                    { name: "rc_analysis_steps", sql: "ALTER TABLE tickets ADD COLUMN rc_analysis_steps VARCHAR(50) DEFAULT 'Tracking'" },
                    { name: "feedback_to_rd", sql: "ALTER TABLE tickets ADD COLUMN feedback_to_rd TEXT" },
                    { name: "rd_instructions_feedback_to_rc", sql: "ALTER TABLE tickets ADD COLUMN rd_instructions_feedback_to_rc TEXT" },
                    { name: "component_replaced", sql: "ALTER TABLE tickets ADD COLUMN component_replaced VARCHAR(255)" },
                    { name: "final_summary", sql: "ALTER TABLE tickets ADD COLUMN final_summary TEXT" },
                    { name: "pronto_rca_analysis_status", sql: "ALTER TABLE tickets ADD COLUMN pronto_rca_analysis_status VARCHAR(50) DEFAULT 'Tracking'" },
                    { name: "normal_repair_status", sql: "ALTER TABLE tickets ADD COLUMN normal_repair_status VARCHAR(50) DEFAULT 'Visual Check'" },
                    { name: "rca_end_date", sql: "ALTER TABLE tickets ADD COLUMN rca_end_date DATE" },
                    { name: "closed_date", sql: "ALTER TABLE tickets ADD COLUMN closed_date DATE" },
                    { name: "additional_remarks", sql: "ALTER TABLE tickets ADD COLUMN additional_remarks TEXT" }
                ];

                const runNextStatement = (index) => {
                    if (index >= statements.length) {
                        const runNextColumnStatement = (columnIndex) => {
                            if (columnIndex >= columnStatements.length) {
                                console.log("Database tables are ready.");
                                return;
                            }

                            const column = columnStatements[columnIndex];
                            db.query("SHOW COLUMNS FROM tickets LIKE ?", [column.name], (err, rows) => {
                                if (err) {
                                    console.error("Database initialization failed:", err);
                                    process.exit(1);
                                    return;
                                }

                                if (rows.length > 0) {
                                    return runNextColumnStatement(columnIndex + 1);
                                }

                                db.query(column.sql, (err) => {
                                    if (err) {
                                        console.error("Database initialization failed:", err);
                                        process.exit(1);
                                        return;
                                    }
                                    runNextColumnStatement(columnIndex + 1);
                                });
                            });
                        };

                        runNextColumnStatement(0);
                        return;
                    }

                    db.query(statements[index], (err) => {
                        if (err) {
                            console.error("Database initialization failed:", err);
                            process.exit(1);
                            return;
                        }
                        runNextStatement(index + 1);
                    });
                };

                runNextStatement(0);
            });
        });
    });
}

initializeDatabase();

// ===========================================================
// TICKETS
// ===========================================================

// Create a new ticket
app.post("/api/tickets", (req, res) => {
    const {
        intimateDate,
        country,
        prontoNo,
        partCode,
        unitName,
        partGroup,
        partFamily,
        unitVersion,
        serialNumber,
        faultDescription,
        ownerType,
        ownerName,
        createdBy,
        priority,
        rcAnalysisSteps,
        feedbackToRd,
        rdInstructionsFeedbackToRc,
        componentReplaced,
        finalSummary,
        prontoRcaAnalysisStatus,
        normalRepairStatus,
        rcaEndDate,
        additionalRemarks
    } = req.body;

    if (!prontoNo) {
        return res.status(400).json({ error: "Pronto Number is required." });
    }

    const normalizedPriority = (priority || "No Priority").toString().trim() || "No Priority";
    const normalizedRcAnalysisSteps = (rcAnalysisSteps || "Tracking").toString().trim() || "Tracking";
    const normalizedProntoRcaAnalysisStatus = (prontoRcaAnalysisStatus || "Tracking").toString().trim() || "Tracking";
    const normalizedNormalRepairStatus = (normalRepairStatus || "Visual Check").toString().trim() || "Visual Check";
    const parsedRcaEndDate = (rcaEndDate || "").toString().trim();
    // ..

    let computedStatus = normalizeStatus(req.body.status || "Open");

    if (parsedRcaEndDate) {
        computedStatus = "Closed";
    }

    const computedClosedDate =
        computedStatus === "Closed" ?
        (parsedRcaEndDate || getCurrentDateString()) :
        null;
    const sql = `
        INSERT INTO tickets
        (intimate_date, country, pronto_no, part_code, unit_name,
         part_group, part_family, unit_version, serial_number,
         fault_description, owner_type, owner_name, created_by,
         priority, rc_analysis_steps, feedback_to_rd, rd_instructions_feedback_to_rc,
         component_replaced, final_summary, pronto_rca_analysis_status,
         normal_repair_status, rca_end_date, closed_date, additional_remarks, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        intimateDate || null,
        country || null,
        prontoNo,
        partCode || null,
        unitName || null,
        partGroup || null,
        partFamily || null,
        unitVersion || null,
        serialNumber || null,
        faultDescription || null,
        ownerType || null,
        ownerName || null,
        createdBy || null,
        normalizedPriority,
        normalizedRcAnalysisSteps,
        feedbackToRd || null,
        rdInstructionsFeedbackToRc || null,
        componentReplaced || null,
        finalSummary || null,
        normalizedProntoRcaAnalysisStatus,
        normalizedNormalRepairStatus,
        parsedRcaEndDate || null,
        computedClosedDate,
        additionalRemarks || null,
        computedStatus
    ];

    console.log("INSERT_DEBUG", {
        placeholderCount: (sql.match(/\?/g) || []).length,
        valueCount: values.length,
        values
    });

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Error creating ticket:", err);
            console.error("Insert values:", values);
            return res.status(500).json({ error: err.sqlMessage || "Database error while creating ticket." });
        }
        res.json({ message: "Ticket created", id: result.insertId });
    });
});

// Get all OPEN tickets (used by the dashboard + edit-ticket list)
app.get("/api/tickets", (req, res) => {
    db.query(
        "SELECT * FROM tickets WHERE LOWER(status) != 'closed' ORDER BY created_at DESC",
        (err, rows) => {
            if (err) {
                console.error("Error fetching tickets:", err);
                return res.status(500).json({ error: "Database error while fetching tickets." });
            }
            res.json(serializeTickets(rows));
        }
    );
});

// Get all CLOSED tickets
app.get("/api/tickets/closed", (req, res) => {
    db.query(
        "SELECT * FROM tickets WHERE LOWER(status) = 'closed' ORDER BY created_at DESC",
        (err, rows) => {
            if (err) {
                console.error("Error fetching closed tickets:", err);
                return res.status(500).json({ error: "Database error while fetching closed tickets." });
            }
            res.json(serializeTickets(rows));
        }
    );
});

// Get a single ticket by ID
app.get("/api/tickets/:id", (req, res) => {
    db.query("SELECT * FROM tickets WHERE id = ?", [req.params.id], (err, rows) => {
        if (err) {
            console.error("Error fetching ticket:", err);
            return res.status(500).json({ error: "Database error while fetching ticket." });
        }
        if (rows.length === 0) {
            return res.status(404).json({ error: "Ticket not found." });
        }
        res.json(serializeTicket(rows[0]));
    });
});

// Update / edit a ticket
app.put("/api/tickets/:id", (req, res) => {
    const {
        intimateDate,
        country,
        prontoNo,
        partCode,
        unitName,
        partGroup,
        partFamily,
        unitVersion,
        serialNumber,
        faultDescription,
        ownerType,
        ownerName,
        status,
        priority,
        rcAnalysisSteps,
        feedbackToRd,
        rdInstructionsFeedbackToRc,
        componentReplaced,
        finalSummary,
        prontoRcaAnalysisStatus,
        normalRepairStatus,
        rcaEndDate,
        additionalRemarks
    } = req.body;

    if (!prontoNo) {
        return res.status(400).json({ error: "Pronto Number is required." });
    }

    if (!priority || !priority.toString().trim()) {
        return res.status(400).json({ error: "Priority is required." });
    }

    db.query("SELECT status FROM tickets WHERE id = ?", [req.params.id], (err, rows) => {
        if (err) {
            console.error("Error loading ticket before update:", err);
            return res.status(500).json({ error: "Database error while updating ticket." });
        }

        if (rows.length === 0) {
            return res.status(404).json({ error: "Ticket not found." });
        }

        if (isClosedStatus(rows[0].status) && !isAdminRequest(req)) {
            return res.status(403).json({ error: "Only admins can edit a closed ticket." });
        }

        const normalizedPriority = priority.toString().trim();
        const normalizedRcAnalysisSteps = (rcAnalysisSteps || "Tracking").toString().trim() || "Tracking";
        const normalizedProntoRcaAnalysisStatus = (prontoRcaAnalysisStatus || "Tracking").toString().trim() || "Tracking";
        const normalizedNormalRepairStatus = (normalRepairStatus || "Visual Check").toString().trim() || "Visual Check";
        const selectedStatus = status ? normalizeStatus(status) : "Open";
        const normalizedStatus = rcaEndDate || isClosedStatus(selectedStatus) ? "Closed" : selectedStatus;
        const computedClosedDate = normalizedStatus === "Closed" ? (rcaEndDate || getCurrentDateString()) : null;

        console.log("UPDATE_TICKET", { id: req.params.id, rcaEndDate, selectedStatus, normalizedStatus, computedClosedDate });

        const sql = `
            UPDATE tickets SET
                intimate_date = ?, country = ?, pronto_no = ?, part_code = ?, unit_name = ?,
                part_group = ?, part_family = ?, unit_version = ?, serial_number = ?,
                fault_description = ?, owner_type = ?, owner_name = ?,
                priority = ?, rc_analysis_steps = ?, feedback_to_rd = ?,
                rd_instructions_feedback_to_rc = ?, component_replaced = ?, final_summary = ?,
                pronto_rca_analysis_status = ?, normal_repair_status = ?, rca_end_date = ?,
                closed_date = ?, additional_remarks = ?, status = ?
            WHERE id = ?
        `;

        const values = [
            intimateDate || null, country || null, prontoNo, partCode || null, unitName || null,
            partGroup || null, partFamily || null, unitVersion || null, serialNumber || null,
            faultDescription || null, ownerType || null, ownerName || null,
            normalizedPriority, normalizedRcAnalysisSteps, feedbackToRd || null,
            rdInstructionsFeedbackToRc || null, componentReplaced || null, finalSummary || null,
            normalizedProntoRcaAnalysisStatus, normalizedNormalRepairStatus, rcaEndDate || null,
            computedClosedDate, additionalRemarks || null, normalizedStatus, req.params.id
        ];

        db.query(sql, values, (err) => {
            if (err) {
                console.error("Error updating ticket:", err);
                return res.status(500).json({ error: "Database error while updating ticket." });
            }
            res.json({ message: "Ticket updated" });
        });
    });
});

// Close a ticket (shortcut endpoint, only changes status)
app.put("/api/tickets/:id/close", (req, res) => {
    const closedDate = getCurrentDateString();
    db.query(
        "UPDATE tickets SET status = 'Closed', closed_date = ?, rca_end_date = COALESCE(rca_end_date, ?) WHERE id = ?", [closedDate, closedDate, req.params.id],
        (err) => {
            if (err) {
                console.error("Error closing ticket:", err);
                return res.status(500).json({ error: "Database error while closing ticket." });
            }
            res.json({ message: "Ticket closed" });
        }
    );
});

// Delete a ticket
app.delete("/api/tickets/:id", (req, res) => {
    db.query("DELETE FROM tickets WHERE id = ?", [req.params.id], (err) => {
        if (err) {
            console.error("Error deleting ticket:", err);
            return res.status(500).json({ error: "Database error while deleting ticket." });
        }
        res.json({ message: "Ticket deleted" });
    });
});

// ===========================================================
// PART CODES (Data Master)
// ===========================================================

app.get("/api/part-codes", (req, res) => {
    db.query("SELECT * FROM part_codes ORDER BY part_code ASC", (err, rows) => {
        if (err) {
            console.error("Error fetching part codes:", err);
            return res.status(500).json({ error: "Database error while fetching part codes." });
        }
        res.json(rows);
    });
});

app.get("/api/part-codes/:code", (req, res) => {
    db.query(
        "SELECT * FROM part_codes WHERE part_code = ?", [req.params.code],
        (err, rows) => {
            if (err) {
                console.error("Error fetching part code:", err);
                return res.status(500).json({ error: "Database error." });
            }
            if (rows.length === 0) {
                return res.status(404).json({ error: "Part code not found." });
            }
            res.json(rows[0]);
        }
    );
});

app.post("/api/part-codes", (req, res) => {
    const { partCode, unitName, partGroup, partFamily } = req.body;

    if (!partCode) {
        return res.status(400).json({ error: "Part Code is required." });
    }

    db.query(
        "INSERT INTO part_codes (part_code, unit_name, part_group, part_family) VALUES (?, ?, ?, ?)", [partCode, unitName || null, partGroup || null, partFamily || null],
        (err, result) => {
            if (err) {
                console.error("Error creating part code:", err);
                return res.status(500).json({ error: "Database error while creating part code." });
            }
            res.json({ message: "Part code created", id: result.insertId });
        }
    );
});

app.delete("/api/part-codes/:id", (req, res) => {
    db.query("DELETE FROM part_codes WHERE id = ?", [req.params.id], (err) => {
        if (err) {
            console.error("Error deleting part code:", err);
            return res.status(500).json({ error: "Database error while deleting part code." });
        }
        res.json({ message: "Part code deleted" });
    });
});

// ===========================================================
// R&D OWNERS (Data Master)
// ===========================================================

app.get("/api/rd-owners", (req, res) => {
    db.query("SELECT * FROM rd_owners ORDER BY name ASC", (err, rows) => {
        if (err) {
            console.error("Error fetching R&D owners:", err);
            return res.status(500).json({ error: "Database error while fetching R&D owners." });
        }
        res.json(rows);
    });
});

app.post("/api/rd-owners", (req, res) => {
    const { name, email } = req.body;

    if (!name) {
        return res.status(400).json({ error: "Name is required." });
    }

    db.query(
        "INSERT INTO rd_owners (name, email) VALUES (?, ?)", [name, email || null],
        (err, result) => {
            if (err) {
                console.error("Error creating R&D owner:", err);
                return res.status(500).json({ error: "Database error while creating R&D owner." });
            }
            res.json({ message: "R&D owner created", id: result.insertId });
        }
    );
});

app.delete("/api/rd-owners/:id", (req, res) => {
    db.query("DELETE FROM rd_owners WHERE id = ?", [req.params.id], (err) => {
        if (err) {
            console.error("Error deleting R&D owner:", err);
            return res.status(500).json({ error: "Database error while deleting R&D owner." });
        }
        res.json({ message: "R&D owner deleted" });
    });
});

// ===========================================================
// RC OWNERS (Data Master)
// ===========================================================

app.get("/api/rc-owners", (req, res) => {
    db.query("SELECT * FROM rc_owners ORDER BY name ASC", (err, rows) => {
        if (err) {
            console.error("Error fetching RC owners:", err);
            return res.status(500).json({ error: "Database error while fetching RC owners." });
        }
        res.json(rows);
    });
});

app.post("/api/rc-owners", (req, res) => {
    const { name, email } = req.body;

    if (!name) {
        return res.status(400).json({ error: "Name is required." });
    }

    db.query(
        "INSERT INTO rc_owners (name, email) VALUES (?, ?)", [name, email || null],
        (err, result) => {
            if (err) {
                console.error("Error creating RC owner:", err);
                return res.status(500).json({ error: "Database error while creating RC owner." });
            }
            res.json({ message: "RC owner created", id: result.insertId });
        }
    );
});

app.delete("/api/rc-owners/:id", (req, res) => {
    db.query("DELETE FROM rc_owners WHERE id = ?", [req.params.id], (err) => {
        if (err) {
            console.error("Error deleting RC owner:", err);
            return res.status(500).json({ error: "Database error while deleting RC owner." });
        }
        res.json({ message: "RC owner deleted" });
    });
});

// ===========================================================
// DASHBOARD SUMMARY (counts for dashboard.html)
// ===========================================================

app.get("/api/dashboard/summary", (req, res) => {
    db.query(
        `SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status IN ('Open', 'Opened', 'In Progress') THEN 1 ELSE 0 END) AS open_count,
            SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress_count,
            SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS closed_count
         FROM tickets`,
        (err, rows) => {
            if (err) {
                console.error("Error fetching dashboard summary:", err);
                return res.status(500).json({ error: "Database error while fetching dashboard summary." });
            }
            res.json(rows[0]);
        }
    );
});

app.get("/api/dashboard/status-summary", (req, res) => {
    db.query(
        `SELECT
            SUM(CASE WHEN status IN ('Open', 'Opened') THEN 1 ELSE 0 END) AS opened,
            SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS closed,
            COUNT(*) AS total
         FROM tickets`,
        (err, rows) => {
            if (err) {
                console.error("Error fetching status summary:", err);
                return res.status(500).json({ error: "Database error while fetching status summary." });
            }
            const data = rows[0] || {};
            res.json({
                opened: Number(data.opened || 0),
                in_progress: Number(data.in_progress || 0),
                closed: Number(data.closed || 0),
                total: Number(data.total || 0)
            });
        }
    );
});

app.get("/api/dashboard/monthly-status-summary", (req, res) => {
    const year = parseInt(req.query.year || new Date().getFullYear(), 10);
    const month = req.query.month;
    const params = [year];
    let whereClause = "WHERE YEAR(created_at) = ?";

    if (month && month !== "all") {
        whereClause += " AND MONTH(created_at) = ?";
        params.push(parseInt(month, 10));
    }

    db.query(
        `SELECT
            MONTH(created_at) AS month_num,
            SUM(CASE WHEN status IN ('Open', 'Opened') THEN 1 ELSE 0 END) AS opened,
            SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS closed
         FROM tickets
         ${whereClause}
         GROUP BY MONTH(created_at)
         ORDER BY MONTH(created_at)`,
        params,
        (err, rows) => {
            if (err) {
                console.error("Error fetching monthly status summary:", err);
                return res.status(500).json({ error: "Database error while fetching monthly status summary." });
            }

            const monthRows = Array.from({ length: 12 }, (_, index) => {
                const monthNumber = index + 1;
                const matchingRow = (rows || []).find((row) => Number(row.month_num) === monthNumber);
                return {
                    month_num: monthNumber,
                    month_label: new Date(2000, index, 1).toLocaleString("en-US", { month: "short" }),
                    opened: Number(matchingRow ? matchingRow.opened : 0),
                    in_progress: Number(matchingRow ? matchingRow.in_progress : 0),
                    closed: Number(matchingRow ? matchingRow.closed : 0),
                    total: Number(matchingRow ? matchingRow.opened : 0) +
                        Number(matchingRow ? matchingRow.in_progress : 0) +
                        Number(matchingRow ? matchingRow.closed : 0)
                };
            });

            if (month && month !== "all") {
                res.json(monthRows.filter((item) => Number(item.month_num) === Number(month)));
            } else {
                res.json(monthRows);
            }
        }
    );
});

// ===========================================================

app.listen(3000, () => {
    console.log("Server Running On Port 3000");
});