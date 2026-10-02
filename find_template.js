const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

let inTemplate = false;
let templateStart = -1;

for (let i = 0; i < code.length; i++) {
    if (code[i] === '`') {
        if (inTemplate) {
            inTemplate = false;
        } else {
            inTemplate = true;
            templateStart = i;
        }
    } else if (inTemplate && code[i] === '$' && code[i+1] === '{') {
        i++; // skip {
    }
}

if (inTemplate) {
    console.log('Unclosed template literal starts at position:', templateStart);
    console.log('Context (500 chars before):');
    console.log(code.substring(Math.max(0, templateStart - 500), templateStart + 200));
    
    // Find line number
    const lines = code.substring(0, templateStart).split('\n');
    console.log('Line number:', lines.length);
    console.log('Line content:', lines[lines.length - 1]);
}