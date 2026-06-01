const fs = require('fs');

const code = fs.readFileSync('public/index.dev.html', 'utf8');
const lines = code.split('\n');

const cases = [
  { name: 'TopBar', line: 507 },
  { name: 'ObCard', line: 736 },
  { name: 'ObPipeline', line: 755 },
  { name: 'GeladeiraView', line: 778 },
  { name: 'CadencesView', line: 842 },
  { name: 'AgentConfigView', line: 929 },
  { name: 'EngineDashboard', line: 1023 },
  { name: 'AgentLogView', line: 1045 },
  { name: 'ObDetailModal', line: 1235 }
];

cases.forEach(c => {
  console.log(`=== ${c.name} (starts around line ${c.line}) ===`);
  // Print 50 lines to find where the function returns and ends
  const startIdx = Math.max(0, c.line - 2);
  const endIdx = Math.min(lines.length, c.line + 70);
  
  let printed = false;
  for (let i = startIdx; i < endIdx; i++) {
    // Print the lines near the return statement closing
    if (lines[i].includes(');') && i > c.line + 2) {
      console.log(`Found close at line ${i+1}: ${lines[i].trim()}`);
      // Print 3 lines before and after
      for (let j = Math.max(0, i - 4); j <= Math.min(lines.length - 1, i + 2); j++) {
        const marker = j === i ? '>>>' : '   ';
        console.log(`${marker} ${j+1}: ${lines[j].trim()}`);
      }
      printed = true;
      break;
    }
  }
  if (!printed) {
    console.log('No closing ");" found in range.');
  }
});
