const acorn = require('acorn');

// Test the validateResource function in isolation with necessary context
const code = `
let resourceFileInput = null;

function cleanText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function setFieldError(errorId, fieldId, message) {}

const MODAL_ERRORS = {
    resourceModal: [["resourceError", "resourceName"], ["resourceError", "resourceLink"]]
};

function focusFirstInvalid(pairs) {}

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
}

function isValidHttpUrl(value) {
    const candidate = cleanText(value);
    if (!candidate) return false;
    let parsed = null;
    try { parsed = new URL(candidate); } catch (e) { return false; }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return Boolean(parsed.hostname);
}

function wireLiveValidation(form, pairs, validate) {}

const resourceForm = document.getElementById("resourceForm");

wireLiveValidation(
    resourceForm,
    MODAL_ERRORS.resourceModal,
    validateResource
);
`;

try {
    acorn.parse(code, { ecmaVersion: 2020 });
    console.log('validateResource section parses OK');
} catch (e) {
    console.log('Error:', e.message);
    console.log('Line:', e.loc?.line, 'Column:', e.loc?.column);
}