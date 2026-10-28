// ticket.js
// Handles the "Create Ticket" form: collects field values and sends them to the backend API.

const ticketForm = document.getElementById("ticketForm");

// Auto-fill Unit Name / Part Group / Part Family when a Part Code is chosen.
// This pulls the part details from the backend so the dropdown options
// always match whatever you saved in the Part Code master page.
const partCodeSelect = document.getElementById("partCode");

if (partCodeSelect) {
    partCodeSelect.addEventListener("change", async function() {
        const code = this.value;

        if (!code) {
            document.getElementById("unitName").value = "";
            document.getElementById("partGroup").value = "";
            document.getElementById("partFamily").value = "";
            return;
        }

        try {
            const res = await fetch(`http://localhost:3000/api/part-codes/${code}`);
            if (res.ok) {
                const part = await res.json();
                document.getElementById("unitName").value = part.unit_name || "";
                document.getElementById("partGroup").value = part.part_group || "";
                document.getElementById("partFamily").value = part.part_family || "";
            }
        } catch (err) {
            console.warn("[ticket] could not fetch part code details:", err);
        }
    });
}

if (ticketForm) {
    ticketForm.addEventListener("submit", async function(e) {
        e.preventDefault();

        const statusEl = document.getElementById("statusMessage");

        const requiredFields = [
            { id: "intimateDate", label: "Received Date" },
            { id: "country", label: "Country" },
            { id: "prontoNo", label: "Pronto Number" },
            { id: "partCode", label: "Unit Part Code" },
            { id: "unitVersion", label: "Unit Version" },
            { id: "serialNumber", label: "Unit Serial Number" },
            { id: "faultDescription", label: "Field Fault Description" },
            { id: "rcOwnerName", label: "RC Owner" },
            { id: "rdOwnerName", label: "R&D Owner" }
        ];

        const missingField = requiredFields.find((field) => {
            const el = document.getElementById(field.id);
            return el && !String(el.value || "").trim();
        });

        if (missingField) {
            if (statusEl) {
                statusEl.style.color = "#d32f2f";
                statusEl.innerText = `${missingField.label} is required.`;
            }
            return;
        }

        const payload = {
            intimateDate: document.getElementById("intimateDate").value,
            country: document.getElementById("country").value,
            prontoNo: document.getElementById("prontoNo").value,
            partCode: document.getElementById("partCode").value,
            unitName: document.getElementById("unitName").value,
            partGroup: document.getElementById("partGroup").value,
            partFamily: document.getElementById("partFamily").value,
            unitVersion: document.getElementById("unitVersion").value,
            serialNumber: document.getElementById("serialNumber").value,
            faultDescription: document.getElementById("faultDescription").value,
            ownerType: "RC Owner",
            ownerName: document.getElementById("rcOwnerName").value || document.getElementById("rdOwnerName").value || "",
            createdBy: localStorage.getItem("loggedInUser") || "unknown"
        };

        try {
            const res = await fetch("http://localhost:3000/api/tickets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                if (statusEl) {
                    statusEl.style.color = "#16a34a";
                    statusEl.innerText = "Ticket created successfully! Ticket ID: " + data.id;
                }
                ticketForm.reset();
                window.dispatchEvent(new CustomEvent("tickets-updated"));
            } else {
                if (statusEl) {
                    statusEl.style.color = "#d32f2f";
                    statusEl.innerText = data.error || "Something went wrong creating the ticket.";
                }
            }
        } catch (err) {
            console.error("[ticket] create failed:", err);
            if (statusEl) {
                statusEl.style.color = "#d32f2f";
                statusEl.innerText = "Could not reach the server. Is server.js running?";
            }
        }
    });
}