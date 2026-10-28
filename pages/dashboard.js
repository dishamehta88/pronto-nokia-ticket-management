// dashboard.js
// Loads the summary counts, charts, and the most recent tickets for the Dashboard page.

let statusChart;
let barChart;

async function loadSummary() {
    try {
        const res = await fetch("/api/dashboard/summary");
        const data = await res.json();

        document.getElementById("totalCount").innerText = data.total || 0;
        document.getElementById("openCount").innerText = data.open_count || 0;
        document.getElementById("closedCount").innerText = data.closed_count || 0;
    } catch (err) {
        console.error("[dashboard] failed to load summary:", err);
    }
}

function showEmptyState(canvas, emptyState, message) {
    canvas.style.display = "none";
    emptyState.style.display = "block";
    emptyState.innerText = message;
}

function hideEmptyState(canvas, emptyState) {
    canvas.style.display = "block";
    emptyState.style.display = "none";
}

function createStatusChart(data) {
    const canvas = document.getElementById("statusChart");
    const emptyState = document.getElementById("statusChartEmpty");
    const values = [
        Number(data.opened || 0),
        Number(data.in_progress || 0),
        Number(data.closed || 0)
    ];

    if (values.every((value) => value === 0)) {
        showEmptyState(canvas, emptyState, "No tickets available");
        return;
    }

    hideEmptyState(canvas, emptyState);

    if (statusChart) {
        statusChart.destroy();
    }

    const ctx = canvas.getContext("2d");
    statusChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Opened", "In Progress", "Closed"],
            datasets: [{
                data: values,
                backgroundColor: [
                    "#f59e0b", // Opened - Yellow
                    "#3b82f6", // In Progress - Blue
                    "#10b981" // Closed - Green
                ],
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: "easeOutQuart"
            },
            plugins: {
                legend: {
                    position: "right",
                    labels: {
                        color: "#374151",
                        padding: 16,
                        boxWidth: 12
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const value = Number(context.raw || 0);
                            const total = values.reduce((sum, item) => sum + item, 0);
                            const percent = total === 0 ? 0 : ((value / total) * 100).toFixed(0);
                            return `${context.label}: ${value} (${percent}%)`;
                        }
                    }
                }
            }
        }
    });
}

function createBarChart(data) {
    const canvas = document.getElementById("barChart");
    const emptyState = document.getElementById("barChartEmpty");
    const labels = data.map((item) => item.month_label);
    const opened = data.map((item) => Number(item.opened || 0));
    const inProgress = data.map((item) => Number(item.in_progress || 0));
    const closed = data.map((item) => Number(item.closed || 0));

    if (!labels.length || (opened.every((value) => value === 0) && inProgress.every((value) => value === 0) && closed.every((value) => value === 0))) {
        showEmptyState(canvas, emptyState, "No tickets available");
        return;
    }

    hideEmptyState(canvas, emptyState);

    if (barChart) {
        barChart.destroy();
    }

    const ctx = canvas.getContext("2d");

    // Determine y-axis maximum so ticks show integer steps (0,1,2,3...)
    const allValues = opened.concat(inProgress, closed);
    const maxValue = allValues.length ? Math.max(...allValues) : 0;
    const suggestedMax = Math.max(7, maxValue);

    barChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                    label: "Opened",
                    data: opened,
                    backgroundColor: "#f59e0b",
                    stack: "stack1"
                },
                {
                    label: "In Progress",
                    data: inProgress,
                    backgroundColor: "#3b82f6",
                    stack: "stack1"
                },
                {
                    label: "Closed",
                    data: closed,
                    backgroundColor: "#10b981",
                    stack: "stack1"
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: "easeOutQuart"
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        color: "#374151"
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    suggestedMax: suggestedMax,
                    ticks: {
                        color: "#374151",
                        stepSize: 1,
                        precision: 0
                    },
                    grid: {
                        color: "rgba(0, 0, 0, 0.06)"
                    }
                }
            },
            plugins: {
                legend: {
                    position: "top",
                    labels: {
                        color: "#374151"
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${context.parsed.y}`,
                        footer: (items) => {
                            const total = items.reduce((sum, item) => sum + Number(item.parsed.y || 0), 0);
                            return `Total: ${total}`;
                        }
                    }
                }
            }
        }
    });
}

async function loadStatusChart() {
    try {
        const res = await fetch("/api/dashboard/status-summary");
        const data = await res.json();
        createStatusChart(data);
    } catch (err) {
        console.error("[dashboard] failed to load status chart:", err);
    }
}

async function loadBarChart() {
    const year = document.getElementById("yearSelect").value;
    const month = document.getElementById("monthSelect").value;

    try {
        const res = await fetch(`/api/dashboard/monthly-status-summary?year=${year}${month !== "all" ? `&month=${month}` : ""}`);
        const data = await res.json();
        createBarChart(data);
    } catch (err) {
        console.error("[dashboard] failed to load monthly chart:", err);
    }
}

function populateFilters() {
    const yearSelect = document.getElementById("yearSelect");
    const monthSelect = document.getElementById("monthSelect");
    const currentYear = new Date().getFullYear();

    yearSelect.innerHTML = "";
    [currentYear - 1, currentYear, currentYear + 1].forEach((year) => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });
    yearSelect.value = currentYear;

    monthSelect.innerHTML = "";
    const monthOption = document.createElement("option");
    monthOption.value = "all";
    monthOption.textContent = "All Months";
    monthSelect.appendChild(monthOption);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    monthNames.forEach((name, index) => {
        const option = document.createElement("option");
        option.value = index + 1;
        option.textContent = name;
        monthSelect.appendChild(option);
    });
}

async function loadRecentTickets() {
    const body = document.getElementById("recentTicketsBody");

    try {
        const res = await fetch("/api/tickets");
        const tickets = await res.json();

        if (!tickets || tickets.length === 0) {
            body.innerHTML = `<tr><td colspan="5" class="empty-state">No tickets yet. Create one to get started.</td></tr>`;
            return;
        }

        const rows = tickets.slice(0, 8).map((t) => `
            <tr>
                <td>${t.pronto_no || "-"}</td>
                <td>${t.country || "-"}</td>
                <td>${t.owner_name || "-"}</td>
                <td><span class="status-badge ${t.status === "Closed" ? "status-closed" : "status-open"}">${t.status}</span></td>
                <td>${t.intimate_date ? new Date(t.intimate_date).toLocaleDateString() : "-"}</td>
            </tr>
        `).join("");

        body.innerHTML = rows;
    } catch (err) {
        console.error("[dashboard] failed to load tickets:", err);
        body.innerHTML = `<tr><td colspan="5" class="empty-state">Could not reach the server. Is server.js running?</td></tr>`;
    }
}

async function loadDashboardData() {
    await Promise.all([loadSummary(), loadStatusChart(), loadBarChart()]);
    await loadRecentTickets();
}

populateFilters();
document.getElementById("yearSelect").addEventListener("change", loadBarChart);
document.getElementById("monthSelect").addEventListener("change", loadBarChart);
window.addEventListener("focus", loadDashboardData);
window.addEventListener("tickets-updated", loadDashboardData);
setInterval(loadDashboardData, 15000);
loadDashboardData();