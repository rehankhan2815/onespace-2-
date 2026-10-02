const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

let braceCount = 0;
let parenCount = 0;
let bracketCount = 0;
let inString = false;
let stringChar = '';
let escaped = false;
let inTemplate = false;

for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1];
    
    if (escaped) {
        escaped = false;
        continue;
    }
    
    if (ch === '\\') {
        escaped = true;
        continue;
    }
    
    if (inString) {
        if (ch === stringChar) {
            inString = false;
        }
        continue;
    }
    
    if (inTemplate) {
        if (ch === '`') {
            inTemplate = false;
        } else if (ch === '$' && next === '{') {
            // template literal expression
        }
        continue;
    }
    
    if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
        continue;
    }
    
    if (ch === '`') {
        inTemplate = true;
        continue;
    }
    
    if (ch === '(') parenCount++;
    else if (ch === ')') parenCount--;
    else if (ch === '{') braceCount++;
    else if (ch === '}') braceCount--;
    else if (ch === '[') bracketCount++;
    else if (ch === ']') bracketCount--;
    
    if (braceCount < 0) {
        // Found extra closing brace
        const start = Math.max(0, i - 100);
        const end = Math.min(code.length, i + 100);
        console.log('=== EXTRA CLOSING BRACE FOUND ===');
        console.log('Position:', i);
        console.log('Context:');
        console.log(code.substring(start, end));
        console.log('\n=== LINE NUMBER ===');
        const lines = code.substring(0, i).split('\n');
        console.log('Line:', lines.length);
        console.log('Line content:', lines[lines.length - 1]);
        break;
    }
}

console.log('\nFinal counts - Parens:', parenCount, 'Braces:', braceCount, 'Brackets:', bracketCount);