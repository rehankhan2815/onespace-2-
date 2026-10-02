const fs = require('fs');
const acorn = require('acorn');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');
const lines = code.split('\n');

// Remove lines 7766-7870 (resourceForm.addEventListener and wireResourceModal IIFE)
const withoutResource = lines.slice(0, 7765).join('\n') + '\n' + lines.slice(7871).join('\n');

try {
    acorn.parse(withoutResource, { ecmaVersion: 2020 });
    console.log('Without resource section: OK');
} catch (e) {
    console.log('Without resource section error:', e.message);
    console.log('Line:', e.loc?.line, 'Column:', e.loc?.column);
}