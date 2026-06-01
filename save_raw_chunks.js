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
          fs.writeFileSync('extracted_chunks.txt', tc.args.ReplacementChunks);
          console.log('Wrote chunks to extracted_chunks.txt');
        }
      });
    }
  } catch (e) {
  }
});
