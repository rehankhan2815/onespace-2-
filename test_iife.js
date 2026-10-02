const acorn = require('acorn');

const code = `
(function wireResourceModal() {
    const linkRadio = document.querySelector('input[name="resourceType"][value="link"]');
    const fileRadio = document.querySelector('input[name="resourceType"][value="file"]');
    const linkSection = document.getElementById("resourceLinkSection");
    const fileSection = document.getElementById("resourceFileSection");
    const fileNameEl = document.getElementById("resourceFileName");
    const pickBtn = document.getElementById("resourcePickFileButton");
    const fileInput = document.getElementById("resourceFileInput");

    function setType(isFile) {
        if (linkRadio) linkRadio.checked = !isFile;
        if (fileRadio) fileRadio.checked = isFile;
        if (linkSection) linkSection.hidden = isFile;
        if (fileSection) fileSection.hidden = !isFile;
    }

    if (linkRadio) {
        linkRadio.addEventListener("change", function () {
            if (this.checked) setType(false);
        });
    }
    if (fileRadio) {
        fileRadio.addEventListener("change", function () {
            if (this.checked) setType(true);
        });
    }
    if (pickBtn && fileInput) {
        pickBtn.addEventListener("click", function () {
            fileInput.click();
        });
    }
    if (fileInput) {
        fileInput.addEventListener("change", function () {
            resourceFileInput = fileInput;
            if (fileInput.files.length) {
                fileNameEl.textContent = fileInput.files[0].name;
            } else {
                fileNameEl.textContent = "";
            }
        });
    }
})();
`;

try {
    acorn.parse(code, { ecmaVersion: 2020 });
    console.log('wireResourceModal IIFE parses OK');
} catch (e) {
    console.log('Error:', e.message);
    console.log('Line:', e.loc?.line, 'Column:', e.loc?.column);
}