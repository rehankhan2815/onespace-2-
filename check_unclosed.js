const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Find all /* ... */ comments and check if they're closed
let inComment = false;
let commentStart = -1;

for (let i = 0; i < code.length; i++) {
    if (code[i] === '/' && code[i+1] === '*') {
        if (!inComment) {
            inComment = true;
            commentStart = i;
        }
        i++; // skip *
    } else if (code[i] === '*' && code[i+1] === '/') {
        if (inComment) {
            inComment = false;
            commentStart = -1;
        }
        i++; // skip /
    }
}

if (inComment) {
    console.log('Unclosed comment starting at position:', commentStart);
    console.log('Context:', code.substring(commentStart, commentStart + 200));
} else {
    console.log('All comments are closed');
}

// Also check for unclosed strings
let inString = false;
let stringChar = '';
let escaped = false;
for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (inString) {
        if (ch === stringChar) { inString = false; }
        continue;
    }
    if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
    }
}
if (inString) {
    console.log('Unclosed string at end of file');
} else {
    console.log('All strings are closed');
}

// Check template literals
let inTemplate = false;
for (let i = 0; i < code.length; i++) {
    if (code[i] === '`') {
        if (inTemplate) {
            inTemplate = false;
        } else {
            inTemplate = true;
        }
    } else if (inTemplate && code[i] === '$' && code[i+1] === '{') {
        // template expression
    }
}
if (inTemplate) {
    console.log('Unclosed template literal at end of file');
} else {
    console.log('All template literals are closed');
}