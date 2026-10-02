const acorn = require('acorn');
const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Try to parse with error recovery - collect all errors
const errors = [];
try {
    acorn.parse(code, { 
        ecmaVersion: 2020, 
        onComment: [],
        allowReturnOutsideFunction: true,
        allowImportExportEverywhere: true,
        allowAwaitOutsideFunction: true
    });
    console.log('Parse OK');
} catch (e) {
    console.log('Error:', e.message);
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

// Try to find all parse errors by parsing incrementally
const lines = code.split('\n');
console.log('\n=== Incremental parsing ===');
let lastGood = 0;
for (let i = 1; i <= lines.length; i += 100) {
    const testCode = lines.slice(0, i).join('\n');
    try {
        acorn.parse(testCode, { ecmaVersion: 2020 });
        lastGood = i;
    } catch (e) {
        console.log(`Failed at line ${i}: ${e.message}`);
        break;
    }
}
console.log('Last good line:', lastGood);