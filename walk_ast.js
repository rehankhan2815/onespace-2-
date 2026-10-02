const acorn = require('acorn');
const fs = require('fs');

const code = fs.readFileSync('E:\\onespace_personal\\frontend\\js\\app.js', 'utf8');

// Try to walk the AST and find unclosed nodes
try {
    const ast = acorn.parse(code, { 
        ecmaVersion: 2020, 
        onComment: [],
        allowReturnOutsideFunction: true,
        allowImportExportEverywhere: true,
        allowAwaitOutsideFunction: true,
        ranges: true
    });
    
    // Walk the AST and check for unclosed nodes
    function walk(node, depth = 0) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'BlockStatement' || node.type === 'FunctionBody') {
            if (!node.end) {
                console.log('Unclosed block at:', node.loc?.start);
            }
        }
        for (const key in node) {
            if (key !== 'loc' && key !== 'range' && node[key] && typeof node[key] === 'object') {
                walk(node[key], depth + 1);
            }
        }
    }
    
    walk(ast);
    console.log('AST walk complete - no unclosed blocks found');
    
} catch (e) {
    console.log('Error:', e.message);
    console.log('Line:', e.loc?.line, 'Column:', e.loc?.column);
}