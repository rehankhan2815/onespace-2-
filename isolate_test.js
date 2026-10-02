const fs = require('fs');
const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Extract just the resourceForm.addEventListener section
const start = code.indexOf('resourceForm.addEventListener');
const end = code.indexOf('});', start) + 2;
const section = code.substring(start, end);

console.log('=== SECTION ===');
console.log(section);
console.log('\n=== TRYING TO PARSE ===');

try {
    new Function(section);
    console.log('Section parses OK');
} catch (e) {
    console.log('Section error:', e.message);
}

// Try the whole file with acorn-style parsing
try {
    // Use a simple approach - wrap in a function
    new Function(code);
    console.log('Full file parses OK');
} catch (e) {
    console.log('Full file error:', e.message);
    // Find the line
    const lines = code.split('\n');
    for (let i = 7820; i < Math.min(7835, lines.length); i++) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
}