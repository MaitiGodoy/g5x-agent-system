const fs = require('fs');

const logPath = 'C:/Users/user/.gemini/antigravity/brain/38c95955-6b0c-4f9b-968d-d2fd34cb3119/.system_generated/logs/transcript.jsonl';

if (!fs.existsSync(logPath)) {
  console.log('Log file does not exist');
  process.exit(1);
}

const lines = fs.readFileSync(logPath, 'utf8').split('\n');

lines.forEach((line, idx) => {
  if (!line.trim()) return;
  try {
    const obj = JSON.parse(line);
    if (obj.tool_calls) {
      obj.tool_calls.forEach(tc => {
        if (tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') {
          console.log(`\n=========================================`);
          console.log(`STEP ${obj.step_index || idx}: ${tc.name}`);
          
          let chunks = tc.args.ReplacementChunks;
          if (typeof chunks === 'string') {
            try {
              // Use eval to safely evaluate the array-like string representation
              chunks = eval('(' + chunks + ')');
            } catch (e) {
              console.log('Failed to eval chunks:', e.message);
            }
          }
          
          if (Array.isArray(chunks)) {
            console.log(`Chunks count: ${chunks.length}`);
            chunks.forEach((chunk, cidx) => {
              console.log(`\n--- Chunk ${cidx+1} ---`);
              console.log(`StartLine: ${chunk.StartLine}, EndLine: ${chunk.EndLine}`);
              console.log(`TargetContent:\n${chunk.TargetContent}`);
              console.log(`ReplacementContent:\n${chunk.ReplacementContent}`);
            });
          }
        }
      });
    }
  } catch (e) {
  }
});
