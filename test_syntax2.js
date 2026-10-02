const fs = require('fs');
const acorn = require('acorn');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

try {
    acorn.parse(code, { ecmaVersion: 2020 });
    console.log('Syntax OK');
} catch (e) {
    console.log('Syntax Error:', e.message);
    console.log('Line:', e.loc.line);
    console.log('Column:', e.loc.column);
    console.log('Pos:', e.pos);
    // Show context around the error
    const lines = code.split('\n');
    const start = Math.max(0, e.loc.line - 5);
    const end = Math.min(lines.length, e.loc.line + 5);
    for (let i = start; i < end; i++) {
        const marker = i === e.loc.line - 1 ? '>>> ' : '    ';
        console.log(`${marker}${i + 1}: ${lines[i]}`);
    }
}