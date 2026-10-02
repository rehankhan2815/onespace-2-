const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Find the resourceForm.addEventListener section and replace with arrow function version
const oldSection = `resourceForm.addEventListener(
    "submit",
    function (event) {

        event.preventDefault();

        const values = validateResource();

        if (!values) {
            focusFirstInvalid(MODAL_ERRORS.resourceModal);
            return;
        }

        if (values.type === "file") {
            const reader = new FileReader();
            reader.onload = function () {
                const resource = {
                    id: Date.now(),
                    title: values.title,
                    type: "file",
                    fileName: values.file.name,
                    fileType: values.file.type || "application/octet-stream",
                    fileData: reader.result,
                    description: values.description,
                    createdAt: nowIso()
                };

                currentWorkspace.resources.push(resource);

                highlight("resource", resource.id);

                closeModal("resourceModal");

                commitChanges({
                    message: "Resource saved."
                });
            };
            reader.readAsDataURL(values.file);
            return;
        }

        const resource = {
            id: Date.now(),
            title: values.title,
            type: "link",
            url: values.url,
            description: values.description,
            createdAt: nowIso()
        };

        currentWorkspace.resources.push(resource);

        highlight("resource", resource.id);

        closeModal("resourceModal");

        commitChanges({
            message: "Resource saved."
        });
    }
);`;

const newSection = `resourceForm.addEventListener(
    "submit",
    (event) => {

        event.preventDefault();

        const values = validateResource();

        if (!values) {
            focusFirstInvalid(MODAL_ERRORS.resourceModal);
            return;
        }

        if (values.type === "file") {
            const reader = new FileReader();
            reader.onload = () => {
                const resource = {
                    id: Date.now(),
                    title: values.title,
                    type: "file",
                    fileName: values.file.name,
                    fileType: values.file.type || "application/octet-stream",
                    fileData: reader.result,
                    description: values.description,
                    createdAt: nowIso()
                };

                currentWorkspace.resources.push(resource);

                highlight("resource", resource.id);

                closeModal("resourceModal");

                commitChanges({
                    message: "Resource saved."
                });
            };
            reader.readAsDataURL(values.file);
            return;
        }

        const resource = {
            id: Date.now(),
            title: values.title,
            type: "link",
            url: values.url,
            description: values.description,
            createdAt: nowIso()
        };

        currentWorkspace.resources.push(resource);

        highlight("resource", resource.id);

        closeModal("resourceModal");

        commitChanges({
            message: "Resource saved."
        });
    }
);`;

if (code.includes(oldSection)) {
    const newCode = code.replace(oldSection, newSection);
    fs.writeFileSync('E:\\onespace_personal\\frontend\\js\\app.js', newCode);
    console.log('Replaced successfully');
} else {
    console.log('Old section not found!');
    // Try to find where it differs
    const idx = code.indexOf('resourceForm.addEventListener(');
    if (idx >= 0) {
        console.log('Found at index:', idx);
        console.log('Context:', code.substring(idx, idx + 200));
    }
}