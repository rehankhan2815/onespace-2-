const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Replace the addEventListener call with extra parentheses around arrow function
const oldCall = `resourceForm.addEventListener(
    "submit",
    (event) => {`;

const newCall = `resourceForm.addEventListener(
    "submit",
    ((event) => {`;

if (code.includes(oldCall)) {
    const newCode = code.replace(oldCall, newCall);
    fs.writeFileSync('E:\\onespace_personal\\frontend\\js\\app.js', newCode);
    console.log('Replaced addEventListener call');
} else {
    console.log('Old call not found');
    const idx = code.indexOf('resourceForm.addEventListener(');
    if (idx >= 0) {
        console.log('Context:', code.substring(idx, idx + 100));
    }
}