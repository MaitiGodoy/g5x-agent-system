const fs = require('fs');

const edits = fs.readFileSync('main_edits.txt', 'utf8');

const dropIdx = edits.indexOf('handleObLeadDrop');
if (dropIdx > -1) {
  // Let's print around the match
  console.log(edits.substring(dropIdx - 100, dropIdx + 1200));
} else {
  console.log('handleObLeadDrop not found');
}
