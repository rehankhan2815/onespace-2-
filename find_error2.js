const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

const pos = 39759;
const start = Math.max(0, pos - 200);
const end = Math.min(code.length, pos + 200);

console.log('=== CONTEXT AROUND ERROR ===');
console.log(code.substring(start, end));
console.log('\n=== LINE NUMBERS ===');
const lines = code.substring(0, pos).split('\n');
console.log('Error is on line:', lines.length);
console.log('Line content:', lines[lines.length - 1]);

// Also check the line
const allLines = code.split('\n');
for (let i = lines.length - 10; i <= lines.length + 10; i++) {
    if (i >= 0 && i < allLines.length) {
        const marker = i === lines.length - 1 ? '>>> ' : '    ';
        console.log(`${marker}${i + 1}: ${allLines[i]}`);
    }
}