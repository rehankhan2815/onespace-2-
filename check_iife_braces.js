const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');
const lines = code.split('\n');

// Check brace balance in wireResourceModal IIFE (lines 7774-7815)
let braceCount = 0;
let inString = false;
let stringChar = '';
let inTemplate = false;
let inComment = false;
let inSingleLineComment = false;
let escaped = false;

for (let i = 7773; i < 7815; i++) { // lines 7774-7815 (0-indexed: 7773-7814)
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        const next = line[j + 1];
        
        if (escaped) { escaped = false; continue; }
        
        if (inSingleLineComment) {
            if (ch === '\n') inSingleLineComment = false;
            continue;
        }
        
        if (inComment) {
            if (ch === '*' && next === '/') { inComment = false; }
            continue;
        }
        
        if (ch === '/' && next === '/') { inSingleLineComment = true; continue; }
        if (ch === '/' && next === '*') { inComment = true; continue; }
        if (ch === '/' && next === '*' && inComment) { /* nested */ continue; }
        
        if (inString) {
            if (ch === '\\') { escaped = true; }
            else if (ch === stringChar) inString = false;
            continue;
        }
        if (inTemplate) {
            if (ch === '`') inTemplate = false;
            else if (ch === '\\') escaped = true;
            continue;
        }
        
        if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
        if (ch === '`') { inTemplate = true; continue; }
        
        if (ch === '{') braceCount++;
        else if (ch === '}') braceCount--;
    }
    console.log(`Line ${i+1}: braceCount = ${braceCount} | ${line.substring(0, 60)}`);
}

console.log('Final brace count in IIFE:', braceCount);