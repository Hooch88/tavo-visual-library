const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const stores = { chat: new Map(), global: new Map(), default: new Map() };
function store(scope) { return stores[scope || 'default'] || stores.default; }
const handlers = {};
const tavo = {
  get(name, scope) { const s = store(scope); return s.has(name) ? s.get(name) : null; },
  set(name, value, scope) { store(scope).set(name, value); },
  unset(name, scope) { store(scope).delete(name); },
  plugin: {
    config: { get() { return null; } },
    on(name, fn) { handlers[name] = fn; }
  },
  file: { url(name, scope) { return `${scope}:${name}`; } },
  message: { find: async () => [], append: async () => true, count: async () => 0 },
  utils: { toast() {} },
  chat: { update: async () => true }
};

stores.chat.set('com.hooch88.tavo.campaignIdentity', { id: 'campaign-one', name: 'Campus', sessionNumber: 2, source: 'storyState' });
stores.chat.set('storyState.state', { campaign: { id: 'legacy-fallback', name: 'Legacy' } });
stores.chat.set('tvl_catalog', [{ id: 'chat-k', name: 'Kendra', type: 'character', aliases: [], fileName: 'chat.jpg' }]);
stores.global.set('tvl_catalog', [{ id: 'global-k', name: 'Kendra', type: 'character', aliases: [], fileName: 'global.jpg' }]);
stores.global.set('tvl_campaign_catalog_v1.campaign-one', [
  { id: 'campaign-k', name: 'Kendra', type: 'character', aliases: [], fileName: 'campaign-k.jpg', fileScope: 'global' },
  { id: 'campaign-p', name: 'Priya', type: 'character', aliases: [], fileName: 'campaign-p.jpg', fileScope: 'global' }
]);
stores.global.set('tvl_campaign_catalog_v1.campaign-two', [
  { id: 'other-r', name: 'Rhea', type: 'character', aliases: [], fileName: 'rhea.jpg', fileScope: 'global' }
]);

const harness = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'entry.js'), 'utf8'), {
  console,
  Math,
  Date,
  String,
  Number,
  Boolean,
  Object,
  Array,
  Set,
  Map,
  Promise,
  RegExp,
  setTimeout(fn) { if (typeof fn === 'function') fn(); return 1; },
  clearTimeout() {},
  tavo,
  __tvlTestHarness: harness
}, { filename: 'entry.js' });

(async () => {
  assert.strictEqual(harness.physicalFileScope('campaign'), 'global', 'Campaign is a logical scope backed by global file storage.');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(harness.getActiveCampaign())), { id: 'campaign-one', name: 'Campus', source: 'storystate' });

  const items = await harness.getAllItems();
  assert(items.some((item) => item.id === 'campaign-p' && item.scope === 'campaign'), 'Current StoryState campaign entries must load.');
  assert(!items.some((item) => item.id === 'other-r'), 'A different campaign must stay isolated.');

  const kendra = harness.resolveMatches(items, 'Kendra');
  assert.strictEqual(kendra.type, 'entry');
  assert.strictEqual(kendra.entry.id, 'chat-k', 'This Chat should override Campaign and Global for an unscoped command.');

  const withoutChat = items.filter((item) => item.scope !== 'chat');
  const campaignKendra = harness.resolveMatches(withoutChat, 'Kendra');
  assert.strictEqual(campaignKendra.type, 'entry');
  assert.strictEqual(campaignKendra.entry.id, 'campaign-k', 'Campaign should override Global after the chat-specific copy is absent.');

  const explicitCampaign = harness.resolveMatches(items, 'campaign:Kendra');
  assert.strictEqual(explicitCampaign.type, 'entry');
  assert.strictEqual(explicitCampaign.entry.id, 'campaign-k');

  const smart = harness.findAutoMatches(items, 'Kendra walks into the lounge.', 'characters');
  assert.strictEqual(smart.length, 1);
  assert.strictEqual(smart[0].item.id, 'chat-k', 'Smart Invocation should use nearest-scope precedence instead of becoming ambiguous after a safe campaign copy.');
  assert(harness.autoHistoryKey(items.find((item) => item.id === 'campaign-p')).includes('campaign-one'), 'Campaign cooldown history must include campaign identity.');

  stores.chat.set('com.hooch88.tavo.campaignIdentity', null);
  stores.chat.set('storyState.state', null);
  stores.chat.set('tvl_campaign_selection_v1', { id: 'campaign-two', name: 'Other World' });
  const manual = harness.getActiveCampaign();
  assert.strictEqual(manual.id, 'campaign-two', 'Standalone campaign selection should work without StoryState.');
  const manualItems = await harness.getAllItems();
  assert(manualItems.some((item) => item.id === 'other-r'), 'Standalone selected campaign entries must load.');
  assert(!manualItems.some((item) => item.id === 'campaign-p'), 'Previously selected campaign must not leak into another campaign.');

  const html = fs.readFileSync(path.join(__dirname, '..', 'ui', 'panel.html'), 'utf8');
  assert(html.includes('<option value="campaign">Campaign</option>'), 'Campaign scope must be visible in the UI.');
  assert(html.includes('id="tvl-copy-chat-campaign"'), 'UI must offer a safe This Chat → Campaign copy action.');
  assert(html.includes('.tvl-campaign-manual[hidden]'), 'StoryState-managed chats must truly hide standalone campaign controls.');
  assert(html.includes('Active campaign:'), 'Campaign UI must explicitly identify the active campaign.');
  assert(html.includes('No This Chat entries to copy'), 'Disabled copy state must explain why copying is unavailable.');
  assert(!html.includes('if (!confirm(`Copy ${chatItems.length} This Chat visual reference'), 'Safe campaign copy should not depend on a confirmation dialog.');
  assert(html.includes("const CAMPAIGN_IDENTITY_KEY = 'com.hooch88.tavo.campaignIdentity'"), 'Panel must use the shared StoryState campaign identity bridge.');
  assert(html.includes("const STORYSTATE_KEY = 'storyState.state'"), 'Panel must retain dev6 StoryState compatibility.');
  assert(html.includes("return scope === 'campaign' ? 'global'"), 'Panel must keep campaign files in global physical storage rather than inventing a Tavo campaign file scope.');

  console.log('Visual Library campaign-scope tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
