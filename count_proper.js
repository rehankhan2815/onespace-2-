const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Proper brace counting with string/comment/regex handling
let braceCount = 0;
let parenCount = 0;
let bracketCount = 0;
let inString = false;
let stringChar = '';
let inTemplate = false;
let inComment = false;
let inRegex = false;
let escaped = false;
let inSingleLineComment = false;

for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1];
    
    if (escaped) {
        escaped = false;
        continue;
    }
    
    if (inSingleLineComment) {
        if (ch === '\n' || ch === '\r') {
            inSingleLineComment = false;
        }
        continue;
    }
    
    if (inComment) {
        if (ch === '*' && next === '/') {
            inComment = false;
            i++;
        }
        continue;
    }
    
    if (inString) {
        if (ch === '\\') {
            escaped = true;
        } else if (ch === stringChar) {
            inString = false;
        }
        continue;
    }
    
    if (inTemplate) {
        if (ch === '`') {
            inTemplate = false;
        } else if (ch === '$' && next === '{') {
            // template expression
        } else if (ch === '\\') {
            escaped = true;
        }
        continue;
    }
    
    if (inRegex) {
        if (ch === '\\') {
            escaped = true;
        } else if (ch === '/') {
            inRegex = false;
        }
        continue;
    }
    
    if (ch === '/') {
        if (next === '/') {
            inSingleLineComment = true;
            i++;
        } else if (next === '*') {
            inComment = true;
            i++;
        } else if (!inRegex) {
            // Could be regex or division - hard to determine without full parser
            // Skip for now
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
}

console.log('Final counts - Parens:', parenCount, 'Braces:', braceCount, 'Brackets:', bracketCount);