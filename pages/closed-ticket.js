// closed-ticket.js
// Loads all tickets with status = Closed.

function formatDateValue(value) {
    if (!value) return "-";
    if (value instanceof Date) {
        const year = value.getUTCFullYear();
        const month = String(value.getUTCMonth() + 1).padStart(2, "0");
        const day = String(value.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed ? trimmed.split("T")[0] : "-";
    }
    return "-";
}

async function loadClosedTickets() {
    const body = document.getElementById("closedTicketsBody");

    try {
        const res = await fetch("http://localhost:3000/api/tickets/closed");
        const tickets = await res.json();

        if (!tickets || tickets.length === 0) {
            body.innerHTML = `<tr><td colspan="6" class="empty-state">No closed tickets yet.</td></tr>`;
            return;
        }

        body.innerHTML = tickets.map(t => `
            <tr>
                <td>${t.pronto_no || "-"}</td>
                <td>${t.country || "-"}</td>
                <td>${t.part_code || "-"}</td>
                <td>${t.owner_name || "-"}</td>
                <td>${formatDateValue(t.intimate_date)}</td>
                <td>${formatDateValue(t.closed_date || t.rca_end_date)}</td>
            </tr>
        `).join("");
    } catch (err) {
        console.error("[closed-ticket] failed to load:", err);
        body.innerHTML = `<tr><td colspan="6" class="empty-state">Could not reach the server. Is server.js running?</td></tr>`;
    }
}

loadClosedTickets();
