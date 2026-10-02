const fs = require('fs');
const acorn = require('acorn');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Remove the wireResourceModal IIFE (lines 7829-7872)
const lines = code.split('\n');
const withoutIIFE = lines.slice(0, 7828).join('\n') + '\n' + lines.slice(7872).join('\n');

try {
    acorn.parse(withoutIIFE, { ecmaVersion: 2020 });
    console.log('Without IIFE: OK');
} catch (e) {
    console.log('Without IIFE error:', e.message);
    console.log('Line:', e.loc?.line, 'Column:', e.loc?.column);
}