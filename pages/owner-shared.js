// owner-shared.js
// Used by both rd-owner.html and rc-owner.html.
// Reads which API endpoint to use from the <script data-endpoint="..."> attribute
// on its own <script> tag, so the same file works for both R&D and RC owners.

const currentScript = document.currentScript;
const endpoint = currentScript.getAttribute("data-endpoint"); // "rd-owners" or "rc-owners"
const API = `/api/${endpoint}`;

async function loadOwners() {
    const body = document.getElementById("listBody");

    try {
        const res = await fetch(API);
        const rows = await res.json();

        if (!rows || rows.length === 0) {
            body.innerHTML = `<tr><td colspan="3" class="empty-state">No owners yet. Add one above.</td></tr>`;
            return;
        }

        body.innerHTML = rows.map(r => `
            <tr>
                <td>${r.name}</td>
                <td>${r.email || "-"}</td>
                <td><button type="button" class="icon-btn danger" title="Delete" onclick="deleteOwner(${r.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button></td>
            </tr>
        `).join("");
    } catch (err) {
        console.error("[owner] failed to load:", err);
        body.innerHTML = `<tr><td colspan="3" class="empty-state">Could not reach the server. Is server.js running?</td></tr>`;
    }
}

async function deleteOwner(id) {
    if (!confirm("Delete this owner?")) return;

    try {
        await fetch(`${API}/${id}`, { method: "DELETE" });
        loadOwners();
    } catch (err) {
        console.error("[owner] failed to delete:", err);
        alert("Could not delete owner.");
    }
}

document.getElementById("addForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const statusEl = document.getElementById("statusMessage");

    const payload = {
        name: document.getElementById("ownerName").value.trim(),
        email: document.getElementById("ownerEmail").value.trim()
    };

    if (!payload.name) {
        statusEl.style.color = "#d32f2f";
        statusEl.innerText = "Name is required.";
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
            statusEl.innerText = "Owner added!";
            document.getElementById("addForm").reset();
            loadOwners();
        } else {
            statusEl.style.color = "#d32f2f";
            statusEl.innerText = data.error || "Could not add owner.";
        }
    } catch (err) {
        console.error("[owner] failed to add:", err);
        statusEl.style.color = "#d32f2f";
        statusEl.innerText = "Could not reach the server.";
    }
});

loadOwners();
