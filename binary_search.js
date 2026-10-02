const fs = require('fs');
const acorn = require('acorn');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');
const lines = code.split('\n');

// Binary search for the first line that causes a parse error
let low = 0;
let high = lines.length;
let lastGood = 0;

while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const testCode = lines.slice(0, mid + 1).join('\n');
    
    try {
        acorn.parse(testCode, { ecmaVersion: 2020 });
        low = mid + 1;
        lastGood = mid;
    } catch (e) {
        high = mid;
    }
}

console.log('First bad line:', low + 1);
console.log('Last good line:', lastGood + 1);
console.log('Bad line content:', lines[low]);
console.log('Good line content:', lines[lastGood]);