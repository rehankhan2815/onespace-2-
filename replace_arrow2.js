const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Replace function (event) { with (event) => {
const newCode = code.replace(
    /resourceForm\.addEventListener\(\s*"submit",\s*function \(event\) \{/g,
    'resourceForm.addEventListener(\n    "submit",\n    (event) => {'
);

// Also replace reader.onload = function () { with reader.onload = () =>
const newCode2 = newCode.replace(
    /reader\.onload = function \(\) \{/g,
    'reader.onload = () => {'
);

fs.writeFileSync('E:\\onespace_personal\\frontend\\js\\app.js', newCode2);
console.log('Replacements done');