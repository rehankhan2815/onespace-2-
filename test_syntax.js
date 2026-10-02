const fs = require('fs');
const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

try {
    new Function(code);
    console.log('Syntax OK');
} catch (e) {
    console.log('Syntax Error:', e.message);
    console.log('Line:', e.lineNumber);
    console.log('Column:', e.columnNumber);
}