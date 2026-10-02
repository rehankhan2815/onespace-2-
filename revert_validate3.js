const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');
const lines = code.split('\n');

// Find the start of validateResource function
let startIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'function validateResource() {') {
        startIdx = i;
        break;
    }
}

if (startIdx === -1) {
    console.log('validateResource function not found');
    process.exit(1);
}

// Find the end of the function (matching })
let braceCount = 0;
let endIdx = -1;
let inFunc = false;
for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (ch === '{') {
            braceCount++;
            inFunc = true;
        } else if (ch === '}') {
            braceCount--;
            if (inFunc && braceCount === 0) {
                endIdx = i;
                break;
            }
        }
    }
    if (endIdx !== -1) break;
}

if (endIdx === -1) {
    console.log('Could not find end of validateResource function');
    process.exit(1);
}

console.log('validateResource from line', startIdx + 1, 'to', endIdx + 1);

// Replace with original simple version
const newValidateLines = [
    'function validateResource() {',
    '',
    '    const title =',
    '        cleanText(',
    '            document',
    '                .getElementById("resourceName")',
    '                .value',
    '        );',
    '',
    '    const url =',
    '        cleanText(',
    '            document',
    '                .getElementById("resourceLink")',
    '                .value',
    '        );',
    '',
    '    if (!title) {',
    '        setFieldError(',
    '            "resourceError",',
    '            "resourceName",',
    '            "Give the resource a name."',
    '        );',
    '        return null;',
    '    }',
    '',
    '    setFieldError("resourceError", "resourceName", "");',
    '',
    '    if (!url) {',
    '    setFieldError(',
    '            "resourceError",',
    '            "resourceLink",',
    '            "Add the link for this resource."',
    '        );',
    '        return null;',
    '    }',
    '',
    '    if (!isValidHttpUrl(url)) {',
    '        setFieldError(',
    '            "resourceError",',
    '            "resourceLink",',
    '            "Enter a full link starting with http:// or https://"',
    '        );',
    '        return null;',
    '    }',
    '',
    '    setFieldError("resourceError", "resourceLink", "");',
    '',
    '    return {',
    '        title: title,',
    '        url: url,',
    '        description: cleanText(',
    '            document',
    '                .getElementById("resourceDescription")',
    '                .value',
    '        )',
    '    };',
    '}'
];

const newLines = lines.slice(0, startIdx).concat(newValidateLines, lines.slice(endIdx + 1));
fs.writeFileSync('E:\\onespace_personal\\frontend\\js\\app.js', newLines.join('\n'));
console.log('Reverted validateResource to original simple version');