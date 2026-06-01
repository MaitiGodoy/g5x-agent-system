const fs = require('fs');

if (!fs.existsSync('extracted_chunks.txt')) {
  console.log('extracted_chunks.txt not found');
  process.exit(1);
}

const raw = fs.readFileSync('extracted_chunks.txt', 'utf8');

// Replace literal newlines with escaped '\n'
// But wait, there might be other control characters. Let's do a robust escape.
// We can use a regex to find all unescaped newlines inside quotes, or simply replace all raw newlines
// since in a JSON array of objects, newlines can only exist inside the string properties.
const escaped = raw.replace(/\r?\n/g, '\\n');

try {
  const parsed = JSON.parse(escaped);
  console.log(`SUCCESS: Parsed ${parsed.length} chunks.`);
  parsed.forEach((chunk, cidx) => {
    console.log(`\n=========================================`);
    console.log(`CHUNK ${cidx+1}: StartLine=${chunk.StartLine}, EndLine=${chunk.EndLine}`);
    console.log(`--- TARGET CONTENT ---`);
    console.log(chunk.TargetContent);
    console.log(`--- REPLACEMENT CONTENT ---`);
    console.log(chunk.ReplacementContent);
  });
} catch (e) {
  console.error('Failed to parse clean JSON:', e.message);
  
  // Fallback: let's try to extract parts using regex
  console.log('\n--- Fallback extraction ---');
  const matches = raw.match(/\{"AllowMultiple":.*?,"TargetContent":".*?"\}/gs);
  if (matches) {
    console.log(`Found ${matches.length} chunk patterns raw.`);
  }
}
