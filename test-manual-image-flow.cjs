const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(`${__dirname}/index.html`, 'utf8');
const begin = html.indexOf('  async function requestManualImages(t, card, btn){');
const end = html.indexOf('  async function requestAutomation(t, card, btn){', begin);
assert.ok(begin !== -1 && end > begin);
let requestBody;
let saved;
let polled;
const context = vm.createContext({
  AUTOMATION_API: 'https://example.test/api/automation-request',
  manualImageState(){},
  rememberAutomationJob(key, job){ saved = {key, job}; },
  pollAutomation(...args){ polled = args; },
  fetch: async (url, init) => {
    requestBody = JSON.parse(init.body);
    return {ok:true, json:async () => ({id:'areq_images',status:'pending',clientToken:'token'})};
  },
});
vm.runInContext(html.slice(begin, end), context);
const card = {querySelector: () => ({value:'두 번째 제목'})};
context.requestManualImages({key:'topic-a', titles:['첫 번째 제목','두 번째 제목']}, card, {});
setImmediate(() => {
  assert.equal(requestBody.mode, 'images_only');
  assert.equal(requestBody.titleIndex, 2);
  assert.equal(saved.key, 'topic-a::images');
  assert.equal(polled[3], 'images_only');
  assert.match(html, /data-act=\\?"images\\?">이미지 생성/);
  assert.match(html, /본문 복사<\/button>/);
  assert.doesNotMatch(html, /본문 복사 \(참고문헌 포함\)/);
  const render = html.slice(html.indexOf('  function renderManualImageReview(card, job){'),
                            html.indexOf('  function pollAutomation(', html.indexOf('  function renderManualImageReview(card, job){')));
  for(const label of ['원본 다운로드','수정 요청문 복사','ChatGPT 열기']) assert.ok(render.includes(label));
  assert.ok(!render.includes('automation-save'));
  console.log('manual image UI regression passed');
});
