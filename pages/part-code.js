// part-code.js
// Add new part codes and list/delete existing ones.

const API = "/api/part-codes";

async function loadPartCodes() {
    const body = document.getElementById("listBody");

    try {
        const res = await fetch(API);
        const rows = await res.json();

        if (!rows || rows.length === 0) {
            body.innerHTML = `<tr><td colspan="5" class="empty-state">No part codes yet. Add one above.</td></tr>`;
            return;
        }

        body.innerHTML = rows.map(r => `
            <tr>
                <td>${r.part_code}</td>
                <td>${r.unit_name || "-"}</td>
                <td>${r.part_group || "-"}</td>
                <td>${r.part_family || "-"}</td>
                <td><button type="button" class="icon-btn danger" title="Delete" onclick="deletePartCode(${r.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button></td>
            </tr>
        `).join("");
    } catch (err) {
        console.error("[part-code] failed to load:", err);
        body.innerHTML = `<tr><td colspan="5" class="empty-state">Could not reach the server. Is server.js running?</td></tr>`;
    }
}

async function deletePartCode(id) {
    if (!confirm("Delete this part code?")) return;

    try {
        await fetch(`${API}/${id}`, { method: "DELETE" });
        loadPartCodes();
    } catch (err) {
        console.error("[part-code] failed to delete:", err);
        alert("Could not delete part code.");
    }
}

document.getElementById("addForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const statusEl = document.getElementById("statusMessage");

    const payload = {
        partCode: document.getElementById("partCode").value.trim(),
        unitName: document.getElementById("unitName").value.trim(),
        partGroup: document.getElementById("partGroup").value.trim(),
        partFamily: document.getElementById("partFamily").value.trim()
    };

    if (!payload.partCode) {
        statusEl.style.color = "#d32f2f";
        statusEl.innerText = "Part Code is required.";
        return;
    }

    try {
        const res = await fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            statusEl.style.color = "#16a34a";
            statusEl.innerText = "Part code added!";
            document.getElementById("addForm").reset();
            loadPartCodes();
        } else {
            statusEl.style.color = "#d32f2f";
            statusEl.innerText = data.error || "Could not add part code.";
        }
    } catch (err) {
        console.error("[part-code] failed to add:", err);
        statusEl.style.color = "#d32f2f";
        statusEl.innerText = "Could not reach the server.";
    }
});

loadPartCodes();
