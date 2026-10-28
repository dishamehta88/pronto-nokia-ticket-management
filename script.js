// Check if user is logged in

if (!localStorage.getItem("loggedInUser")) {
    window.location.replace("/login.html");
}

const originalFetch = window.fetch.bind(window);
window.fetch = async function (...args) {
    const response = await originalFetch(...args);
    const requestUrl = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
    if (response.status === 401 && requestUrl.startsWith("/api/") && requestUrl !== "/api/auth/login") {
        localStorage.removeItem("loggedInUser");
        localStorage.removeItem("loggedInUserRole");
        window.location.replace("/login.html");
    }
    return response;
};

// Profile dropdown

const profileBtn = document.querySelector(".profile-btn");
const profileMenu = document.querySelector(".profile-menu");

profileBtn.addEventListener("click", function () {

    if (profileMenu.style.display === "block") {
        profileMenu.style.display = "none";
    } else {
        profileMenu.style.display = "block";
    }

});

// Show logged in user

const userEmail = document.getElementById("userEmail");

userEmail.innerText =
    localStorage.getItem("loggedInUser");

// Logout

const logoutBtn =
    document.getElementById("logoutBtn");

logoutBtn.addEventListener("click", async function (e) {

    e.preventDefault();

    try {
        await originalFetch("/api/auth/logout", { method: "POST" });
    } finally {
        localStorage.removeItem("loggedInUser");
        localStorage.removeItem("loggedInUserRole");
        window.location.replace("/login.html");
    }

});

// Close dropdown when clicking elsewhere

window.addEventListener("click", function (e) {

    if (
        !profileBtn.contains(e.target) &&
        !profileMenu.contains(e.target)
    ) {
        profileMenu.style.display = "none";
    }

});
