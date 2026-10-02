const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Revert to original submit handler (without file upload)
const oldHandler = `resourceForm.addEventListener(
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

const newHandler = `resourceForm.addEventListener(
    "submit",
    (event) => {

        event.preventDefault();

        const values = validateResource();

        if (!values) {
            focusFirstInvalid(MODAL_ERRORS.resourceModal);
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

if (code.includes(oldHandler)) {
    const newCode = code.replace(oldHandler, newHandler);
    fs.writeFileSync('E:\\onespace_personal\\frontend\\js\\app.js', newCode);
    console.log('Reverted to original submit handler');
} else {
    console.log('Old handler not found');
    const idx = code.indexOf('resourceForm.addEventListener(');
    if (idx >= 0) {
        console.log('Current handler starts at:', idx);
        console.log('First 200 chars:', code.substring(idx, idx + 300));
    }
}