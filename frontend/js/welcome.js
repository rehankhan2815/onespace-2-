const user = JSON.parse(
    localStorage.getItem("onespaceCurrentUser") || "null"
);

if (!user) {
    window.location.href = "index.html";
}

const params =
    new URLSearchParams(
        window.location.search
    );

const type =
    params.get("type");

const welcomeTitle =
    document.getElementById(
        "welcomeTitle"
    );

const welcomeText =
    document.getElementById(
        "welcomeText"
    );

const continueButton =
    document.getElementById(
        "continueButton"
    );

if (type === "register") {

    welcomeTitle.textContent =
        "Welcome to OneSpace";

    welcomeText.textContent =
        "Welcome, " +
        user.name +
        ". Your workspace starts here.";

} else {

    welcomeTitle.textContent =
        "Hello again";

    welcomeText.textContent =
        "Good to have you back, " +
        user.name +
        ".";

}

continueButton.addEventListener(
    "click",
    function () {

        window.location.href =
            "dashboard.html";
    }
);