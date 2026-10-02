const acorn = require('acorn');
const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Try to parse with error recovery
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
}

// Try parsing with error recovery to find all errors
const errors = [];
const parser = acorn.Parser.extend();
parser.extend(require('acorn').plugins);

try {
    acorn.parse(code, { 
        ecmaVersion: 2020, 
        onComment: [],
        onError: (err) => { errors.push(err); }
    });
    console.log('Parse with recovery OK');
} catch (e) {
    console.log('Parse with recovery error:', e.message);
}

console.log('Total errors found:', errors.length);
errors.forEach(e => console.log('  -', e.message, 'at', e.loc?.line, e.loc?.column));