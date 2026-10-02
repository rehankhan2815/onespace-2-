const fs = require('fs');

const c = fs.readFileSync('E:\\onespace_personal\\original_app_utf8.js', 'utf8');
let braceCount = 0, parenCount = 0, bracketCount = 0;
let inString = false, stringChar = '', escaped = false, inTemplate = false;

for (let i = 0; i < c.length; i++) {
    const ch = c[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (inString) { if (ch === stringChar) inString = false; continue; }
    if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
    if (ch === '`') { inTemplate = !inTemplate; continue; }
    if (ch === '(') parenCount++;
    else if (ch === ')') parenCount--;
    else if (ch === '{') braceCount++;
    else if (ch === '}') braceCount--;
    else if (ch === '[') bracketCount++;
    else if (ch === ']') bracketCount--;
}
console.log('Original: Parens:', parenCount, 'Braces:', braceCount, 'Brackets:', bracketCount);