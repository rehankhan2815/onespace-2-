const fs = require('fs');
const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Try to parse with acorn if available, otherwise use Function constructor
try {
    const acorn = require('acorn');
    acorn.parse(code, { ecmaVersion: 2020 });
    console.log('Syntax OK with acorn');
} catch (e) {
    console.log('Acorn error:', e.message);
    console.log('Line:', e.loc?.line, 'Column:', e.loc?.column);
    if (e.loc) {
        const lines = code.split('\n');
        const line = e.loc.line - 1;
        for (let i = Math.max(0, line - 5); i < Math.min(lines.length, line + 5); i++) {
            const marker = i === line ? '>>> ' : '    ';
            console.log(`${marker}${i + 1}: ${lines[i]}`);
        }
    }
}