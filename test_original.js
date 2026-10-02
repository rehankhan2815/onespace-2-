const acorn = require('acorn');

const code = `
const resourceForm = document.getElementById("resourceForm");

function validateResource() {
    const title = cleanText(document.getElementById("resourceName").value);
    const url = cleanText(document.getElementById("resourceLink").value);
    if (!title) { setFieldError("resourceError", "resourceName", "Give the resource a name."); return null; }
    setFieldError("resourceError", "resourceName", "");
    if (!url) { setFieldError("resourceError", "resourceLink", "Add the link for this resource."); return null; }
    if (!isValidHttpUrl(url)) { setFieldError("resourceError", "resourceLink", "Enter a full link starting with http:// or https://"); return null; }
    setFieldError("resourceError", "resourceLink", "");
    return { title: title, url: url, description: cleanText(document.getElementById("resourceDescription").value) };
}

function isValidHttpUrl(value) {
    const candidate = cleanText(value);
    if (!candidate) return false;
    let parsed = null;
    try { parsed = new URL(candidate); } catch (e) { return false; }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return Boolean(parsed.hostname);
}

function cleanText(value) { return typeof value === "string" ? value.trim() : ""; }
function setFieldError(errorId, fieldId, message) {}
function focusFirstInvalid(pairs) {}
function highlight(kind, id) {}
function closeModal(id) {}
function commitChanges(options) {}
function nowIso() { return new Date().toISOString(); }
let currentWorkspace = { resources: [] };

resourceForm.addEventListener("submit", function(event) {
    event.preventDefault();
    const values = validateResource();
    if (!values) { focusFirstInvalid([]); return; }
    const resource = { id: Date.now(), title: values.title, url: values.url, description: values.description, createdAt: nowIso() };
    currentWorkspace.resources.push(resource);
    highlight("resource", resource.id);
    closeModal("resourceModal");
    commitChanges({ message: "Resource saved." });
});
`;

try {
    acorn.parse(code, { ecmaVersion: 2020 });
    console.log('Original-style code parses OK');
} catch (e) {
    console.log('Error:', e.message);
    console.log('Line:', e.loc?.line, 'Column:', e.loc?.column);
}