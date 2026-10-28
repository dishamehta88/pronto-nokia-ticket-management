// edit-ticket.js
// Lists all open tickets and lets you edit or delete them via a modal popup.

const API = "/api/tickets";

function isAdminUser() {
    return localStorage.getItem("loggedInUserRole") === "admin";
}

function formatDateValue(value) {
    if (!value) return "";
    if (value instanceof Date) {
        const year = value.getUTCFullYear();
        const month = String(value.getUTCMonth() + 1).padStart(2, "0");
        const day = String(value.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed ? trimmed.split("T")[0] : "";
    }
    return "";
}

function setFormReadonly(readOnly) {
    const fields = [
        "editPriority",
        "editRcAnalysisSteps",
        "editIntimateDate",
        "editCountry",
        "editPartCode",
        "editUnitName",
        "editOwnerType",
        "editOwnerName",
        "editFeedbackToRd",
        "editRdInstructionsFeedbackToRc",
        "editComponentReplaced",
        "editProntoRcaAnalysisStatus",
        "editFinalSummary",
        "editNormalRepairStatus",
        "editRcaEndDate",
        "editAdditionalRemarks"
    ];

    fields.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = readOnly;
        }
    });

    const submitBtn = document.querySelector("#editForm .btn");
    if (submitBtn) {
        submitBtn.disabled = readOnly;
    }
}

function updateStatusBadge(status) {
    const badge = document.getElementById("modalStatus");
    if (!badge) return;
    badge.textContent = status || "Open";
    badge.style.color = status === "Closed" ? "#b91c1c" : "#0b3c88";
}

function resetFormState() {
    const statusEl = document.getElementById("statusMessage");
    if (statusEl) {
        statusEl.textContent = "";
    }
}

async function loadTickets() {
    const body = document.getElementById("ticketsBody");

    try {
        const res = await fetch(API);
        const tickets = await res.json();

        if (!tickets || tickets.length === 0) {
            body.innerHTML = `<tr><td colspan="6" class="empty-state">No open tickets. Create one from the Tickets menu.</td></tr>`;
            return;
        }

        body.innerHTML = tickets.map(t => `
            <tr>
                <td>${t.pronto_no || "-"}</td>
                <td>${t.country || "-"}</td>
                <td>${t.part_code || "-"}</td>
                <td>${t.owner_name || "-"}</td>
                <td><span class="status-badge ${t.status === "Closed" ? "status-closed" : "status-open"}">${t.status || "Open"}</span></td>
                <td>
                    <button type="button" class="icon-btn" title="Edit" onclick="openEditModal(${t.id})">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    </button>
                    <button type="button" class="icon-btn danger" title="Delete" onclick="deleteTicket(${t.id})">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                    </button>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        console.error("[edit-ticket] failed to load tickets:", err);
        body.innerHTML = `<tr><td colspan="6" class="empty-state">Could not reach the server. Is server.js running?</td></tr>`;
    }
}

async function openEditModal(id) {
    try {
        const res = await fetch(`${API}/${id}`);
        const t = await res.json();

        document.getElementById("editId").value = t.id;
        document.getElementById("editIntimateDate").value = formatDateValue(t.intimate_date);
        document.getElementById("editCountry").value = t.country || "";
        document.getElementById("editPartCode").value = t.part_code || "";
        document.getElementById("editUnitName").value = t.unit_name || "";
        document.getElementById("editOwnerType").value = t.owner_type || "";
        document.getElementById("editOwnerName").value = t.owner_name || "";
        document.getElementById("editProntoNo").value = t.pronto_no || "";
        document.getElementById("editPriority").value = t.priority || "No Priority";
        document.getElementById("editRcAnalysisSteps").value = t.rc_analysis_steps || "Tracking";
        document.getElementById("editFeedbackToRd").value = t.feedback_to_rd || "";
        document.getElementById("editRdInstructionsFeedbackToRc").value = t.rd_instructions_feedback_to_rc || "";
        document.getElementById("editComponentReplaced").value = t.component_replaced || "";
        document.getElementById("editFinalSummary").value = t.final_summary || "";
        document.getElementById("editProntoRcaAnalysisStatus").value = t.pronto_rca_analysis_status || "Tracking";
        document.getElementById("editNormalRepairStatus").value = t.normal_repair_status || "Visual Check";
        document.getElementById("editRcaEndDate").value = formatDateValue(t.rca_end_date);
        document.getElementById("editAdditionalRemarks").value = t.additional_remarks || "";
        document.getElementById("modalProntoNo").textContent = t.pronto_no || "-";
        document.getElementById("modalOwner").textContent = t.owner_name || "-";
        updateStatusBadge(t.status || "Open");

        const readOnly = t.status === "Closed" && !isAdminUser();
        setFormReadonly(readOnly);
        const banner = document.getElementById("readOnlyBanner");
        if (banner) {
            banner.hidden = !readOnly;
            banner.textContent = readOnly ? "This ticket is closed. Only admins can edit it further." : "";
        }

        resetFormState();
        document.getElementById("editModal").classList.add("show");
    } catch (err) {
        console.error("[edit-ticket] failed to load ticket:", err);
        alert("Could not load ticket details.");
    }
}

async function deleteTicket(id) {
    if (!confirm("Delete this ticket? This cannot be undone.")) return;

    try {
        await fetch(`${API}/${id}`, { method: "DELETE" });
        window.dispatchEvent(new CustomEvent("tickets-updated"));
        loadTickets();
    } catch (err) {
        console.error("[edit-ticket] failed to delete:", err);
        alert("Could not delete ticket.");
    }
}

function closeModal() {
    document.getElementById("editModal").classList.remove("show");
    resetFormState();
}

document.getElementById("closeModalBtn").addEventListener("click", closeModal);
document.getElementById("cancelModalBtn").addEventListener("click", closeModal);

document.getElementById("editRcaEndDate").addEventListener("change", function () {
    updateStatusBadge(this.value ? "Closed" : "Open");
});

document.getElementById("editForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const id = document.getElementById("editId").value;
    const statusEl = document.getElementById("statusMessage");
    const priority = document.getElementById("editPriority").value.trim();

    if (!priority) {
        statusEl.style.color = "#d32f2f";
        statusEl.textContent = "Priority is required.";
        return;
    }

    const payload = {
        intimateDate: document.getElementById("editIntimateDate").value,
        country: document.getElementById("editCountry").value,
        prontoNo: document.getElementById("editProntoNo").value,
        partCode: document.getElementById("editPartCode").value,
        unitName: document.getElementById("editUnitName").value,
        ownerType: document.getElementById("editOwnerType").value,
        ownerName: document.getElementById("editOwnerName").value,
        priority,
        rcAnalysisSteps: document.getElementById("editRcAnalysisSteps").value,
        feedbackToRd: document.getElementById("editFeedbackToRd").value,
        rdInstructionsFeedbackToRc: document.getElementById("editRdInstructionsFeedbackToRc").value,
        componentReplaced: document.getElementById("editComponentReplaced").value,
        finalSummary: document.getElementById("editFinalSummary").value,
        prontoRcaAnalysisStatus: document.getElementById("editProntoRcaAnalysisStatus").value,
        normalRepairStatus: document.getElementById("editNormalRepairStatus").value,
        rcaEndDate: document.getElementById("editRcaEndDate").value,
        additionalRemarks: document.getElementById("editAdditionalRemarks").value,
        status: document.getElementById("modalStatus").textContent || "Open"
    };

    try {
        const res = await fetch(`${API}/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "x-user-role": isAdminUser() ? "admin" : "user"
            },
            body: JSON.stringify(payload)
        });

        const result = await res.json().catch(() => ({}));

        if (res.ok) {
            statusEl.style.color = "#16a34a";
            statusEl.textContent = "Saved!";
            window.dispatchEvent(new CustomEvent("tickets-updated"));
            setTimeout(() => {
                closeModal();
                loadTickets();
            }, 600);
        } else {
            statusEl.style.color = "#d32f2f";
            statusEl.textContent = result.error || "Could not save changes.";
        }
    } catch (err) {
        console.error("[edit-ticket] failed to save:", err);
        statusEl.style.color = "#d32f2f";
        statusEl.textContent = "Could not reach the server.";
    }
});

loadTickets();
