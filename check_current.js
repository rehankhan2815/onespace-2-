const fs = require('fs');

const c = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');
let braceCount = 0, parenCount = 0, bracketCount = 0;
let inString = false, stringChar = '', escaped = false, inTemplate = false;

for (let i = 0; i < c.length; i++) {
    const ch = c[i];
    if (ch === '\\') { 
        // skip escaped character
        continue; 
    }
    if (inString) { 
        if (c === stringChar) inString = false; 
        continue; 
    }
    if (ch === '"' || ch === "'") { 
        inString = true; 
        stringChar = ch; 
        continue; 
    }
    if (ch === '`') { 
        inTemplate = !inTemplate; 
        continue; 
    }
    if (ch === '(') parenCount++;
    else if (ch === ')') parenCount--;
    else if (ch === '{') braceCount++;
    else if (ch === '}') braceCount--;
    else if (ch === '[') bracketCount++;
    else if (ch === ']') bracketCount--;
}
console.log('Current: Parens:', parenCount, 'Braces:', braceCount, 'Brackets:', bracketCount);