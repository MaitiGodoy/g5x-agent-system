const fs = require('fs');

const logPath = 'C:/Users/user/.gemini/antigravity/brain/7c255a38-0ef3-4e46-8af0-d9c4aed70907/.system_generated/logs/transcript.jsonl';

if (!fs.existsSync(logPath)) {
  console.log('Log file does not exist');
  process.exit(1);
}

const lines = fs.readFileSync(logPath, 'utf8').split('\n');
let out = '';

lines.forEach((line, idx) => {
  if (!line.trim()) return;
  try {
    const obj = JSON.parse(line);
    if (obj.tool_calls) {
      obj.tool_calls.forEach(tc => {
        if ((tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') && 
            tc.args.TargetFile && tc.args.TargetFile.includes('index.html')) {
          out += `\n=========================================\n`;
          out += `STEP ${obj.step_index || idx}: ${tc.name}\n`;
          out += `Instruction: ${tc.args.Instruction}\n`;
          out += `Description: ${tc.args.Description}\n`;
          if (tc.args.TargetContent) {
            out += `\n--- TARGET CONTENT ---\n${tc.args.TargetContent}\n`;
            out += `\n--- REPLACEMENT CONTENT ---\n${tc.args.ReplacementContent}\n`;
          }
          if (tc.args.ReplacementChunks) {
            let chunks = tc.args.ReplacementChunks;
            if (typeof chunks === 'string') {
              try { chunks = eval('(' + chunks + ')'); } catch (e) { chunks = null; }
            }
            if (Array.isArray(chunks)) {
              out += `Chunks: ${chunks.length}\n`;
              chunks.forEach((c, cidx) => {
                out += `\n  --- Chunk ${cidx+1} (lines ${c.StartLine}-${c.EndLine}) ---\n`;
                out += `  Target:\n${c.TargetContent}\n`;
                out += `  Replacement:\n${c.ReplacementContent}\n`;
              });
            } else {
              out += `Raw chunks: ${JSON.stringify(tc.args.ReplacementChunks)}\n`;
            }
          }
        }
      });
    }
  } catch (e) {
  }
});

fs.writeFileSync('main_edits.txt', out);
console.log('Wrote edits to main_edits.txt');
