const fs = require('fs');
const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Remove the extra } at line 1523 (0-indexed: 1522)
const lines = code.split('\n');
console.log('Line 1521:', lines[1520]);
console.log('Line 1522:', lines[1521]);
console.log('Line 1523:', lines[1522]);
console.log('Line 1524:', lines[1523]);

// Remove line 1523 (index 1522)
lines.splice(1522, 1);

const newCode = lines.join('\n');
fs.writeFileSync('E:\\onespace_personal\\frontend\\js\\app.js', newCode);
console.log('Removed line 1523');