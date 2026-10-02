const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Find the submit handler and replace with simple version
const lines = code.split('\n');

// Find the start of the submit handler
let startIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('resourceForm.addEventListener(')) {
        startIdx = i;
        break;
    }
}

if (startIdx === -1) {
    console.log('Submit handler not found');
    process.exit(1);
}

// Find the end of the submit handler (matching });
let braceCount = 0;
let endIdx = -1;
let inHandler = false;
for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (ch === '{') {
            braceCount++;
            inHandler = true;
        } else if (ch === '}') {
            braceCount--;
            if (inHandler && braceCount === 0) {
                endIdx = i;
                break;
            }
        }
    }
    if (endIdx !== -1) break;
}

if (endIdx === -1) {
    console.log('Could not find end of handler');
    process.exit(1);
}

console.log('Handler from line', startIdx + 1, 'to', endIdx + 1);

// Replace lines[startIdx] to lines[endIdx] with new handler
const newHandlerLines = [
    'resourceForm.addEventListener(',
    '    "submit",',
    '    (event) => {',
    '',
    '        event.preventDefault();',
    '',
    '        const values = validateResource();',
    '',
    '        if (!values) {',
    '            focusFirstInvalid(MODAL_ERRORS.resourceModal);',
    '            return;',
    '        }',
    '',
    '        const resource = {',
    '            id: Date.now(),',
    '            title: values.title,',
    '            type: "link",',
    '            url: values.url,',
    '            description: values.description,',
    '            createdAt: nowIso()',
    '        };',
    '',
    '        currentWorkspace.resources.push(resource);',
    '',
    '        highlight("resource", resource.id);',
    '',
    '        closeModal("resourceModal");',
    '',
    '        commitChanges({',
    '            message: "Resource saved."',
    '        });',
    '    }',
    ');'
];

const newLines = lines.slice(0, startIdx).concat(newHandlerLines, lines.slice(endIdx + 1));
fs.writeFileSync('E:\\onespace_personal\\frontend\\js\\app.js', newLines.join('\n'));
console.log('Replaced submit handler with simple version');