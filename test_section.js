const fs = require('fs');
const acorn = require('acorn');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');
const lines = code.split('\n');

// Extract just the submit handler section (lines 7766-7826)
const section = lines.slice(7765, 7826).join('\n');

console.log('=== SUBMIT HANDLER SECTION ===');
console.log(section);

try {
    acorn.parse(section, { ecmaVersion: 2020 });
    console.log('Section parses OK');
} catch (e) {
    console.log('Section error:', e.message);
    console.log('Line:', e.loc?.line, 'Column:', e.loc?.column);
    const secLines = section.split('\n');
    const line = e.loc?.line - 1 || 0;
    for (let i = Math.max(0, line - 5); i < Math.min(secLines.length, line + 5); i++) {
        const marker = i === line ? '>>> ' : '    ';
        console.log(`${marker}${i + 1}: ${secLines[i]}`);
    }
}