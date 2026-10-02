const acorn = require('acorn');
const fs = require('fs');
const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');
const lines = code.split('\n');

// Test parsing up to just before resourceForm.addEventListener
const prefix = lines.slice(0, 7765).join('\n');
console.log('=== PARSING UP TO LINE 7765 ===');

try {
    acorn.parse(prefix, { ecmaVersion: 2020 });
    console.log('Prefix parses OK');
} catch (e) {
    console.log('Error:', e.message);
    console.log('Line:', e.loc?.line, 'Column:', e.loc?.column);
    if (e.loc) {
        const prefixLines = prefix.split('\n');
        const line = e.loc.line - 1;
        for (let i = Math.max(0, line - 5); i < Math.min(prefixLines.length, line + 5); i++) {
            const marker = i === line ? '>>> ' : '    ';
            console.log(`${marker}${i + 1}: ${prefixLines[i]}`);
        }
    }
}