const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Find all brace/paren/bracket mismatches by doing a full parse
const lines = code.split('\n');

// Let's check the workspaceTabs event handler area (around line 1520)
console.log('=== Checking workspaceTabs area ===');
for (let i = 1510; i < 1540; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}