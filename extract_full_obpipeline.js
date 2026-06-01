const fs = require('fs');

const edits = fs.readFileSync('main_edits.txt', 'utf8');

const stepIdx = edits.indexOf('STEP 2353:');
if (stepIdx > -1) {
  const replIdx = edits.indexOf('--- REPLACEMENT CONTENT ---', stepIdx);
  const nextStepIdx = edits.indexOf('=========================================', replIdx);
  const content = edits.substring(replIdx + '--- REPLACEMENT CONTENT ---'.length, nextStepIdx > -1 ? nextStepIdx : edits.length);
  fs.writeFileSync('extracted_ob_drag.txt', content);
  console.log('Wrote to extracted_ob_drag.txt');
} else {
  console.log('STEP 2353 not found');
}
