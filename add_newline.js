const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Add final newline if missing
if (!code.endsWith('\n')) {
    const newCode = code + '\n';
    fs.writeFileSync('E:\\onespace_personal\\frontend\\js\\app.js', newCode);
    console.log('Added final newline');
} else {
    console.log('Already has final newline');
}