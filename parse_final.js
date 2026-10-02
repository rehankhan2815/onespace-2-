const acorn = require('acorn');
const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Try to parse with loose mode
try {
    acorn.parse(code, { 
        ecmaVersion: 2020, 
        allowReturnOutsideFunction: true,
        allowImportExportEverywhere: true,
        allowAwaitOutsideFunction: true,
        allowHashBang: true
    });
    console.log('Parse OK');
} catch (e) {
    console.log('Error:', e.message);
    console.log('Line:', e.loc?.line, 'Column:', e.loc?.column);
    if (e.loc) {
        const lines = code.split('\n');
        const line = e.loc.line - 1;
        for (let i = Math.max(0, line - 15); i < Math.min(lines.length, line + 5); i++) {
            const marker = i === line ? '>>> ' : '    ';
            console.log(`${marker}${i + 1}: ${lines[i]}`);
        }
    }
}