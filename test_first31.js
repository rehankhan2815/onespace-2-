const acorn = require('acorn');
const fs = require('fs');
const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');
const lines = code.split('\n');

const first31 = lines.slice(0, 31).join('\n');
console.log('=== FIRST 31 LINES ===');
console.log(first31);
console.log('\n=== PARSING ===');

try {
    acorn.parse(first31, { ecmaVersion: 2020 });
    console.log('First 31 lines parse OK');
} catch (e) {
    console.log('Error:', e.message);
    console.log('Line:', e.loc?.line, 'Column:', e.loc?.column);
}