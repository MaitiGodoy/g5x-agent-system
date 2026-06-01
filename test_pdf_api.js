const {PDFParse} = require('pdf-parse');
const fs = require('fs');

// Inspect PDFParse class
console.log('PDFParse type:', typeof PDFParse);
console.log('PDFParse prototype methods:', PDFParse.prototype ? Object.getOwnPropertyNames(PDFParse.prototype) : 'none');

// Try creating instance without args
try {
  const parser = new PDFParse();
  console.log('Instance created OK');
  console.log('Instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(parser)));
} catch(e) {
  console.log('Constructor error:', e.message);
}

// Try static methods
console.log('Static methods:', Object.getOwnPropertyNames(PDFParse).filter(k => typeof PDFParse[k] === 'function'));
