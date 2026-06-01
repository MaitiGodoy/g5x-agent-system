const { PDFParse } = require('pdf-parse');
const fs = require('fs');

async function run() {
  try {
    const data = fs.readFileSync('C:\\Users\\user\\Downloads\\Cadencia Antifragil (1).pdf');
    const parser = new PDFParse({ data: data });
    const result = await parser.getText();
    console.log('Successfully parsed text! Length:', result.text.length);
    console.log('Sample:', result.text.substring(0, 200));
  } catch (e) {
    console.error('Error parsing:', e);
  }
}

run();
