const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(`${__dirname}/index.html`, 'utf8');
const start = html.indexOf('  function readAutomationImageChoices(jobId){');
const end = html.indexOf('  function readAutomationJobs(){', start);
assert.ok(start !== -1 && end > start, 'image choice helpers exist');
const values = new Map();
const localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};
const context = vm.createContext({localStorage});
vm.runInContext(`var AUTOMATION_IMAGE_CHOICES_KEY = 'test.choices';\n${html.slice(start, end)}`, context);

context.rememberAutomationImageChoice('job-1', 3, {use: false});
context.rememberAutomationImageChoice('job-1', 3, {caption: 'revised caption'});
assert.equal(context.readAutomationImageChoices('job-1')[3].use, false);
assert.equal(context.readAutomationImageChoices('job-1')[3].caption, 'revised caption');
assert.equal(Object.keys(context.readAutomationImageChoices('job-2')).length, 0);
assert.match(html, /typeof savedChoice\.use === "boolean" \? savedChoice\.use : item\.use !== false/);
assert.match(html, /rememberAutomationImageChoice\(job\.id, item\.slot, \{use:event\.target\.checked\}\)/);
context.clearAutomationImageChoices('job-1');
assert.equal(Object.keys(context.readAutomationImageChoices('job-1')).length, 0);
console.log('automation image choice regression passed');
