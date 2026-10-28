const loginForm = document.getElementById("loginForm");

const users = [
    { email: "admin@pronto.com", password: "admin123" },
    { email: "shubham@pronto.com", password: "shubham123" },
    { email: "tl@pronto.com", password: "tl123" },
    { email: "disha@pronto.com", password: "disha123" }
];

if (loginForm) {
    loginForm.addEventListener("submit", function(e) {
        e.preventDefault();

        const emailEl = document.getElementById("email");
        const passEl = document.getElementById("password");
        const errorEl = document.getElementById("errorMessage");

        const email = (emailEl?.value || "").trim().toLowerCase();
        const password = (passEl?.value || "").trim();

        console.log("[login] attempt:", email);

        const user = users.find(u => u.email.toLowerCase() === email && u.password === password);

        if (user) {
            localStorage.setItem("loggedInUser", user.email);
            console.log("[login] success:", user.email);
            window.location.href = "index.html";
            return;
        }

        if (errorEl) errorEl.innerText = "Invalid email or password";
        console.warn("[login] failed for:", email);
    });
} else {
    console.warn("[login] loginForm element not found on page.");
}