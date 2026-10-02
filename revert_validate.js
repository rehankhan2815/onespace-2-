const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Revert validateResource to original simple version (no file upload)
const oldValidate = `let resourceFileInput = null;

function validateResource() {

    const title =
        cleanText(
            document
                .getElementById("resourceName")
                .value
        );

    if (!title) {
        setFieldError(
            "resourceError",
            "resourceName",
            "Give the resource a name."
        );
        return null;
    }

    setFieldError("resourceError", "resourceName", "");

    const resourceType = document.querySelector('input[name="resourceType"]:checked');
    const isFile = resourceType && resourceType.value === "file";

    if (isFile) {
        if (!resourceFileInput || !resourceFileInput.files.length) {
            setFieldError(
                "resourceError",
                "resourceFileInput",
                "Choose a file."
            );
            return null;
        }
        setFieldError("resourceError", "resourceFileInput", "");
        return {
            title: title,
            type: "file",
            file: resourceFileInput.files[0],
            description: cleanText(
                document
                    .getElementById("resourceDescription")
                    .value
            )
        };
    } else {
        const url =
            cleanText(
                document
                    .getElementById("resourceLink")
                    .value
            );

        if (!url) {
            setFieldError(
                "resourceError",
                "resourceLink",
                "Add the link for this resource."
            );
            return null;
        }

        if (!isValidHttpUrl(url)) {
            setFieldError(
                "resourceError",
                "resourceLink",
                "Enter a full link starting with http:// or https://"
            );
            return null;
        }

        setFieldError("resourceError", "resourceLink", "");

        return {
            title: title,
            type: "link",
            url: url,
            description: cleanText(
                document
                    .getElementById("resourceDescription")
                    .value
            )
        };
    }
}`;

const newValidate = `function validateResource() {

    const title =
        cleanText(
            document
                .getElementById("resourceName")
                .value
        );

    const url =
        cleanText(
            document
                .getElementById("resourceLink")
                .value
        );

    if (!title) {
        setFieldError(
            "resourceError",
            "resourceName",
            "Give the resource a name."
        );
        return null;
    }

    setFieldError("resourceError", "resourceName", "");

    if (!url) {
        setFieldError(
            "resourceError",
            "resourceLink",
            "Add the link for this resource."
        );
        return null;
    }

    if (!isValidHttpUrl(url)) {
        setFieldError(
            "resourceError",
            "resourceLink",
            "Enter a full link starting with http:// or https://"
        );
        return null;
    }

    setFieldError("resourceError", "resourceLink", "");

    return {
        title: title,
        url: url,
        description: cleanText(
            document
                .getElementById("resourceDescription")
                .value
        )
    };
}`;

if (code.includes(oldValidate)) {
    const newCode = code.replace(oldValidate, newValidate);
    fs.writeFileSync('E:\\onespace_personal\\frontend\\js\\app.js', newCode);
    console.log('Reverted validateResource to original');
} else {
    console.log('Old validateResource not found');
    const idx = code.indexOf('function validateResource() {');
    if (idx >= 0) {
        console.log('Current validateResource at:', idx);
        console.log('First 200 chars:', code.substring(idx, idx + 300));
    }
}