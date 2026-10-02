const code = `
resourceForm.addEventListener(
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
);
`;

try {
    const acorn = require('acorn');
    acorn.parse(code, { ecmaVersion: 2020 });
    console.log('Test section parses OK');
} catch (e) {
    console.log('Test section error:', e.message);
    console.log('Line:', e.loc?.line, 'Column:', e.loc?.column);
}