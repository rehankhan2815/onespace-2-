const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Use a simple bracket/paren counter to find mismatches
let parenCount = 0;
let braceCount = 0;
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
            // Could track nested braces in template, but skip for now
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
    
    if (parenCount < 0) {
        console.log('Unmatched ) at position', i);
        break;
    }
    if (braceCount < 0) {
        console.log('Unmatched } at position', i);
        break;
    }
    if (bracketCount < 0) {
        console.log('Unmatched ] at position', i);
        break;
    }
}

console.log('Final counts - Parens:', parenCount, 'Braces:', braceCount, 'Brackets:', bracketCount);