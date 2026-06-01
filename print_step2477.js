const fs = require('fs');

const edits = fs.readFileSync('main_edits.txt', 'utf8');

const stepIdx = edits.indexOf('STEP 2477:');
if (stepIdx > -1) {
  // Find the next STEP start or end of file
  let nextStepIdx = edits.indexOf('=========================================', stepIdx + 10);
  if (nextStepIdx === -1) nextStepIdx = edits.length;
  console.log(edits.substring(stepIdx, nextStepIdx));
} else {
  console.log('STEP 2477 not found');
}
