// Check if user is logged in

if (!localStorage.getItem("loggedInUser")) {
    window.location.href = "login.html";
}

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

logoutBtn.addEventListener("click", function (e) {

    e.preventDefault();

    localStorage.removeItem("loggedInUser");

    window.location.href = "login.html";

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