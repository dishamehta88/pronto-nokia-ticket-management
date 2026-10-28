const loginForm = document.getElementById("loginForm");
let setupRequired = false;

async function loadSetupState() {
    const submitButton = loginForm?.querySelector("button[type='submit']");
    const errorEl = document.getElementById("errorMessage");
    if (submitButton) submitButton.disabled = true;

    try {
        const response = await fetch("/api/auth/setup-status");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not check setup status.");
        setupRequired = result.needsSetup;
        if (setupRequired) {
            if (submitButton) submitButton.textContent = "Create Admin Account";
            if (errorEl) {
                errorEl.style.color = "#475569";
                errorEl.textContent = "First-time setup: use the app owner email and create a password with at least 14 characters.";
            }
        }
        if (submitButton) submitButton.disabled = false;
    } catch (_error) {
        if (errorEl) errorEl.textContent = "Could not reach the server. Refresh this page and try again.";
        if (submitButton) submitButton.disabled = false;
    }
}

if (loginForm) {
    loadSetupState();
    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const errorEl = document.getElementById("errorMessage");
        const submitButton = loginForm.querySelector("button[type='submit']");

        if (submitButton) submitButton.disabled = true;
        if (errorEl) errorEl.textContent = "";

        try {
            const response = await fetch(setupRequired ? "/api/auth/setup" : "/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            const result = await response.json();

            if (!response.ok) throw new Error(result.error || "Invalid email or password.");
            localStorage.setItem("loggedInUser", result.email);
            localStorage.setItem("loggedInUserRole", result.role);
            window.location.replace("/index.html");
        } catch (error) {
            if (errorEl) errorEl.textContent = error.message || "Could not reach the server.";
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}
