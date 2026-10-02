const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Find the resourceForm.addEventListener call
const idx = code.indexOf('resourceForm.addEventListener');
if (idx >= 0) {
    // Show 500 chars around it
    const start = Math.max(0, idx - 50);
    const end = Math.min(code.length, idx + 500);
    const snippet = code.substring(start, end);
    
    // Show with character codes
    console.log('=== SNIPPET ===');
    console.log(snippet);
    console.log('\n=== CHAR CODES ===');
    for (let i = 0; i < snippet.length; i++) {
        const ch = snippet[i];
        const code = ch.charCodeAt(0);
        if (code > 127 || ch === ',' || ch === '(' || ch === ')' || ch === '{' || ch === '}') {
            console.log(`Pos ${i}: '${ch}' (${code})`);
        }
    }
}