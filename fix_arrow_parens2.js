const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Fix the double parentheses
const oldCall = `resourceForm.addEventListener(
    "submit",
    ((event) => {`;

const newCall = `resourceForm.addEventListener(
    "submit",
    (event) => {`;

if (code.includes(oldCall)) {
    const newCode = code.replace(oldCall, newCall);
    fs.writeFileSync('E:\\onespace_personal\\frontend\\js\\app.js', newCode);
    console.log('Fixed addEventListener call');
} else {
    console.log('Old call not found');
    const idx = code.indexOf('resourceForm.addEventListener(');
    if (idx >= 0) {
        console.log('Context:', code.substring(idx, idx + 100));
    }
}

// Also fix the closing
const oldClose = `    }
}));
`;

const newClose = `    }
});
`;

const code2 = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');
if (code2.includes(oldClose)) {
    const newCode2 = code2.replace(oldClose, newClose);
    fs.writeFileSync('E:\\onespace_personal\\frontend\\js\\app.js', newCode2);
    console.log('Fixed closing');
} else {
    console.log('Old close not found');
    const idx = code2.indexOf('    }\n});');
    if (idx >= 0) {
        console.log('Context:', code2.substring(idx, idx + 50));
    }
}