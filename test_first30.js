const acorn = require('acorn');
const fs = require('fs');
const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');
const lines = code.split('\n');

const first30 = lines.slice(0, 30).join('\n');
console.log('=== FIRST 30 LINES ===');
console.log(first30);
console.log('\n=== PARSING ===');

try {
    acorn.parse(first30, { ecmaVersion: 2020 });
    console.log('First 30 lines parse OK');
} catch (e) {
    console.log('Error:', e.message);
    console.log('Line:', e.loc?.line, 'Column:', e.loc?.column);
}