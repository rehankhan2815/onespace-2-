const acorn = require('acorn');

const code = `
const resourceForm = document.getElementById("resourceForm");

function validateResource() { return null; }
function focusFirstInvalid(pairs) {}
function highlight(kind, id) {}
function closeModal(id) {}
function commitChanges(options) {}
function nowIso() { return new Date().toISOString(); }
let currentWorkspace = { resources: [] };
let resourceFileInput = null;

resourceForm.addEventListener(
    "submit",
    (event) => {

        event.preventDefault();

        const values = validateResource();

        if (!values) {
            focusFirstInvalid([]);
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
                    createdAt: new Date().toISOString()
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
            createdAt: new Date().toISOString()
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
    acorn.parse(code, { ecmaVersion: 2020 });
    console.log('Submit handler section parses OK');
} catch (e) {
    console.log('Error:', e.message);
    console.log('Line:', e.loc?.line, 'Column:', e.loc?.column);
}