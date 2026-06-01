const fs = require('fs');

console.log("Testing root import:");
try {
  const pdf = require('pdf-parse');
  console.log("root keys:", Object.keys(pdf));
} catch(e) {
  console.log("root import error:", e.message);
}

console.log("\nTesting node import:");
try {
  const pdfNode = require('pdf-parse/node');
  console.log("node keys:", Object.keys(pdfNode));
  if (typeof pdfNode === 'function') {
    console.log("pdfNode is a function!");
  } else if (pdfNode.default && typeof pdfNode.default === 'function') {
    console.log("pdfNode.default is a function!");
  } else {
    for (let k of Object.keys(pdfNode)) {
      console.log(`pdfNode.${k} type:`, typeof pdfNode[k]);
    }
  }
} catch(e) {
  console.log("node import error:", e.message);
}
