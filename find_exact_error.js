const fs = require('fs');
const acorn = require('acorn');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Find the exact position of the error by parsing incrementally
let lastGoodPos = 0;
const chunkSize = 1000;

for (let pos = 0; pos < code.length; pos += chunkSize) {
    const testCode = code.substring(0, pos + chunkSize);
    try {
        acorn.parse(testCode, { ecmaVersion: 2020 });
    } catch (e) {
        console.log('Error at position:', pos);
        console.log('Error:', e.message);
        console.log('Line:', e.loc?.line, 'Column:', e.loc?.column);
        
        // Show context around the error
        const lines = code.substring(0, pos + chunkSize).split('\n');
        const line = e.loc?.line - 1 || lines.length - 1;
        for (let i = Math.max(0, line - 10); i < Math.min(lines.length, line + 10); i++) {
            const marker = i === line ? '>>> ' : '    ';
            console.log(`${marker}${i + 1}: ${lines[i]}`);
        }
        break;
    }
}