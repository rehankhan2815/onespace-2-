const loginForm =
    document.getElementById("loginForm");

const registerForm =
    document.getElementById("registerForm");


let users = JSON.parse(
    localStorage.getItem("onespaceUsers") || "[]"
);


if (registerForm) {

    registerForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            const name =
                document
                    .getElementById("registerName")
                    .value
                    .trim();

            const email =
                document
                    .getElementById("registerEmail")
                    .value
                    .trim()
                    .toLowerCase();

            const password =
                document
                    .getElementById("registerPassword")
                    .value;

            const existingUser =
                users.find(
                    function (user) {
                        return user.email === email;
                    }
                );

            if (existingUser) {
                alert(
                    "An account with this email already exists."
                );
                return;
            }

            const user = {
                id: Date.now(),
                name: name,
                email: email,
                password: password
            };

            users.push(user);

            localStorage.setItem(
                "onespaceUsers",
                JSON.stringify(users)
            );

            localStorage.setItem(
                "onespaceCurrentUser",
                JSON.stringify(user)
            );

            window.location.href =
                "welcome.html?type=register";
        }
    );
}


if (loginForm) {

    loginForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            const email =
                document
                    .getElementById("loginEmail")
                    .value
                    .trim()
                    .toLowerCase();

            const password =
                document
                    .getElementById("loginPassword")
                    .value;

            const user =
                users.find(
                    function (item) {

                        return (
                            item.email === email &&
                            item.password === password
                        );
                    }
                );

            if (!user) {
                alert(
                    "Invalid email or password."
                );
                return;
            }

            localStorage.setItem(
                "onespaceCurrentUser",
                JSON.stringify(user)
            );

            window.location.href =
                "welcome.html?type=login";
        }
    );
}