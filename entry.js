(function () {
  const UI_STATE_KEY = 'tvl_ui_state';
  const CATALOG_KEY = 'tvl_catalog';
  const AUTO_HISTORY_KEY = 'tvl_auto_history_v2';
  const AUTO_PROCESSED_WINDOW_MS = 15000;
  const inFlightFingerprints = new Set();
  const processedFingerprints = new Map();
  const AUTO_STATE_VERSION_KEY = 'tvl_auto_state_version';
  const AUTO_STATE_VERSION = 2;


  function getConfig(key, fallback) {
    try {
      const value = tavo.plugin.config.get(key);
      return value == null ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function itemAllowedByAutoMode(item, mode) {
    if (mode === 'both') return true;
    if (mode === 'characters') return item.type === 'character';
    if (mode === 'places') return item.type === 'place';
    return false;
  }


  function isTrackerBoundaryLine(line) {
    const cleaned = normalizeText(
      String(line || '')
        .replace(/^[\s#>*_`|\-–—:;()[\]{}]+/, '')
        .replace(/[✨📌📍📅🕒⏱️🌐👥🎭🧭]+/g, ' ')
    );
    if (!cleaned || cleaned.length > 160) return false;

    return (
      /parallel.*off.?screen.*tracker/.test(cleaned) ||
      /off.?screen.*tracker/.test(cleaned) ||
      /parallel.*tracker/.test(cleaned) ||
      /^parallel\b/.test(cleaned) ||
      /multiple locations?/.test(cleaned) ||
      /parallel opportunities?/.test(cleaned) ||
      /off.?screen opportunities?/.test(cleaned) ||
      /off.?screen developments?/.test(cleaned) ||
      /multiple locations?.*opportunit/.test(cleaned) ||
      /^(?:npc|character|relationship|world|event|arc|story|status|continuity) tracker\b/.test(cleaned) ||
      /^off.?screen developments?\b/.test(cleaned) ||
      /^behind the scenes\b/.test(cleaned)
    );
  }

  function isTrackerEntryLine(line) {
    const raw = String(line || '').trim();
    if (!raw) return false;
    const cleaned = raw.replace(/^[\s>*_`|\-–—•]+/, '');
    const m = cleaned.match(/^([^:\n]{1,48}):\s+(.{8,})$/);
    if (!m) return false;
    const label = normalizeText(m[1]);
    if (!label) return false;
    const wordCount = label.split(/\s+/).filter(Boolean).length;
    return wordCount <= 6;
  }

  function stripNonNarrativeSections(content) {
    const text = String(content || '')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/```[\s\S]*?```/g, ' ');
    const lines = text.split(/\r?\n/);
    const kept = [];
    let substantiveLines = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let nextNonEmpty = '';
      for (let j = i + 1; j < lines.length; j++) {
        if (normalizeText(lines[j])) {
          nextNonEmpty = lines[j];
          break;
        }
      }

      if (isTrackerBoundaryLine(line)) {
        if (substantiveLines === 0) return '';
        break;
      }

      if (isTrackerEntryLine(line) && isTrackerEntryLine(nextNonEmpty)) {
        if (substantiveLines === 0) return '';
        break;
      }

      kept.push(line);
      if (normalizeText(line)) substantiveLines += 1;
    }

    return kept.join('\n').trim();
  }

  function canonicalNameParts(item) {
    return String(item && item.name || '')
      .split(/\s+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 4);
  }

  function buildImplicitNameCounts(items, mode) {
    const counts = new Map();
    for (const item of items) {
      if (!itemAllowedByAutoMode(item, mode)) continue;
      for (const part of canonicalNameParts(item)) {
        const key = normalizeText(part);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return counts;
  }

  function findAutoMatches(items, content, mode) {
    const text = String(content || '');
    if (!text.trim()) return [];

    const implicitCounts = buildImplicitNameCounts(items, mode);
    const candidates = [];

    for (const item of items) {
      if (!itemAllowedByAutoMode(item, mode)) continue;

      const explicitNames = dedupeStrings([item.name, ...(item.aliases || [])])
        .filter((name) => name.length >= 3)
        .map((name) => ({ name, kind: normalizeText(name) === normalizeText(item.name) ? 'canonical' : 'alias' }));

      // Canonical first/last name parts are useful in prose ("Skye", "Dawson").
      // Only add a part when it is unique across eligible library entries so a shared
      // surname/first name never causes an arbitrary match.
      const implicitNames = canonicalNameParts(item)
        .filter((part) => implicitCounts.get(normalizeText(part)) === 1)
        .map((name) => ({ name, kind: 'implicit' }));

      const namesByKey = new Map();
      for (const entry of [...explicitNames, ...implicitNames]) {
        const key = normalizeText(entry.name);
        if (!key) continue;
        const existing = namesByKey.get(key);
        const rank = { canonical: 3, alias: 2, implicit: 1 };
        if (!existing || rank[entry.kind] > rank[existing.kind]) namesByKey.set(key, entry);
      }
      const names = [...namesByKey.values()].sort((a, b) => b.name.length - a.name.length);

      let best = null;
      for (const entry of names) {
        const pattern = new RegExp(`(^|[^A-Za-z0-9_])${escapeRegex(entry.name)}(?=$|[^A-Za-z0-9_])`, 'ig');
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const prefixLength = match[1] ? match[1].length : 0;
          const index = match.index + prefixLength;
          const rank = { canonical: 3, alias: 2, implicit: 1 }[entry.kind] || 0;
          if (
            !best ||
            index > best.matchedIndex ||
            (index === best.matchedIndex && rank > best.kindRank) ||
            (index === best.matchedIndex && rank === best.kindRank && entry.name.length > best.matchedName.length)
          ) {
            best = {
              item,
              matchedName: entry.name,
              matchedIndex: index,
              matchKind: entry.kind,
              kindRank: rank
            };
          }
          if (pattern.lastIndex === match.index) pattern.lastIndex += 1;
        }
      }
      if (best) candidates.push(best);
    }

    // If the exact same textual form points to multiple entries, discard that form.
    const counts = new Map();
    for (const candidate of candidates) {
      const key = normalizeText(candidate.matchedName);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const unambiguous = candidates.filter((candidate) => counts.get(normalizeText(candidate.matchedName)) === 1);
    unambiguous.sort((a, b) => {
      // Narrative focus: the most recently mentioned eligible entry wins.
      if (a.matchedIndex !== b.matchedIndex) return b.matchedIndex - a.matchedIndex;
      if (a.kindRank !== b.kindRank) return b.kindRank - a.kindRank;
      if (b.matchedName.length !== a.matchedName.length) return b.matchedName.length - a.matchedName.length;
      if (a.item.scope !== b.item.scope) return a.item.scope === 'chat' ? -1 : 1;
      return String(a.item.name || '').localeCompare(String(b.item.name || ''));
    });
    return unambiguous;
  }

  function autoHistoryKey(entry) {
    return `${entry.scope || 'chat'}:${entry.id || normalizeText(entry.name)}`;
  }

  function getAutoHistory() {
    const value = tavo.get(AUTO_HISTORY_KEY) || {};
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function setAutoHistory(history) {
    tavo.set(AUTO_HISTORY_KEY, history);
  }

  function resetAutoState() {
    try { tavo.unset(AUTO_HISTORY_KEY); } catch (e) {}
    try { tavo.unset(AUTO_RECENT_KEY); } catch (e) {}
    tavo.set(AUTO_STATE_VERSION_KEY, AUTO_STATE_VERSION);
  }

  function ensureAutoStateVersion() {
    const stored = Number(tavo.get(AUTO_STATE_VERSION_KEY));
    if (stored !== AUTO_STATE_VERSION) resetAutoState();
  }

  function normalizeText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function escapeMarkdown(value) {
    return String(value || '').replace(/([\\`*_{}\[\]()#+\-.!|>])/g, '\\$1');
  }

  async function getCatalog(scope) {
    const value = tavo.get(CATALOG_KEY, scope);
    return Array.isArray(value) ? value : [];
  }

  async function setUiState(patch) {
    const current = tavo.get(UI_STATE_KEY) || {};
    tavo.set(UI_STATE_KEY, { ...current, ...patch });
  }

  function hydrate(items, scope) {
    return (items || []).map((item) => ({
      ...item,
      scope,
      aliases: Array.isArray(item.aliases) ? item.aliases : []
    }));
  }

  async function getAllItems() {
    const [chatItems, globalItems] = await Promise.all([
      getCatalog('chat'),
      getCatalog('global')
    ]);
    return [...hydrate(chatItems, 'chat'), ...hydrate(globalItems, 'global')];
  }

  function dedupeStrings(values) {
    const seen = new Set();
    const result = [];
    for (const value of values) {
      const normalized = normalizeText(value);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(String(value).trim());
    }
    return result;
  }

  function resolveMatches(items, rawQuery) {
    let query = String(rawQuery || '').trim();
    let scopeFilter = null;

    const scoped = query.match(/^(chat|global)\s*:\s*(.+)$/i);
    if (scoped) {
      scopeFilter = scoped[1].toLowerCase();
      query = scoped[2].trim();
    }

    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
      return { type: 'missing-query' };
    }

    const filteredItems = scopeFilter
      ? items.filter((item) => item.scope === scopeFilter)
      : items;

    const exact = [];
    const partial = [];

    for (const item of filteredItems) {
      const names = dedupeStrings([item.name, ...(item.aliases || [])]);
      let partialMatched = false;

      for (const name of names) {
        const normalizedName = normalizeText(name);
        if (!normalizedName) continue;

        if (normalizedName === normalizedQuery) {
          exact.push(item);
          partialMatched = false;
          break;
        }

        if (normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName)) {
          partialMatched = true;
        }
      }

      if (partialMatched) partial.push(item);
    }

    const sortMatches = (a, b) => {
      if (a.scope !== b.scope) return a.scope === 'chat' ? -1 : 1;
      return String(a.name || '').localeCompare(String(b.name || ''));
    };

    exact.sort(sortMatches);
    partial.sort(sortMatches);

    if (exact.length === 1) return { type: 'entry', entry: exact[0] };
    if (exact.length > 1) return { type: 'ambiguous', matches: exact, query };
    if (partial.length === 1) return { type: 'entry', entry: partial[0] };
    if (partial.length > 1) return { type: 'ambiguous', matches: partial, query };
    return { type: 'not-found', query };
  }

  function buildImagePath(entry) {
    if (entry.path) return entry.path;
    return tavo.file.url(entry.fileName, entry.scope || 'chat');
  }

  function buildVisualMessage(entry) {
    const title = escapeMarkdown(entry.name || 'Untitled');
    const imagePath = buildImagePath(entry);
    return `<!-- TVL_VISUAL_REFERENCE -->
![${title}](${imagePath})`;
  }

  async function getLastNarratorMessage() {
    try {
      const messages = await tavo.message.find([], { role: 'assistant', hidden: false });
      if (!Array.isArray(messages)) return null;
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        const content = String(message && message.content || '');
        if (!content.includes('<!-- TVL_VISUAL_REFERENCE -->')) return message;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async function getVisualSpeakerId(preferredCharacterId = null) {
    const preferred = Number(preferredCharacterId);
    if (Number.isFinite(preferred) && preferred > 0) return preferred;
    const lastNarrator = await getLastNarratorMessage();
    const id = lastNarrator && Number(lastNarrator.characterId);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  async function showEntryInChat(entry, preferredCharacterId = null) {
    const content = buildVisualMessage(entry);
    const characterId = await getVisualSpeakerId(preferredCharacterId);
    const message = { role: 'assistant', content, hidden: false };
    if (characterId) message.characterId = characterId;
    const result = await tavo.message.append(message);
    if (!result) throw new Error('Unable to append the visual reference message.');
    return result;
  }

  tavo.plugin.on('sidebar:open-visual-library', async () => {
    await setUiState({ open: true, section: 'library', nonce: Date.now() });
  });

  tavo.plugin.on('sidebar:reset-smart-cooldown', async () => {
    resetAutoState();
    tavo.utils.toast('Visual Library: Smart Invocation cooldown reset for this chat.');
  });


  tavo.plugin.on('sidebar:restore-theme-background', async () => {
    try {
      await tavo.chat.update({ background: null });
      tavo.utils.toast('Visual Library: restored the theme background for this chat.');
    } catch (error) {
      console.error('[Tavo Visual Library] Failed to restore theme background:', error);
      tavo.utils.toast(`Visual Library: failed to restore theme background: ${error.message || 'unknown error'}`);
    }
  });

  tavo.plugin.on('input:beforeSend', async (event) => {
    const text = String(event.text || '').trim();
    if (!/^\/show(?:\s|$)/i.test(text)) return;

    const match = text.match(/^\/show\s+(.+)$/i);
    if (!match) {
      await setUiState({ open: true, section: 'library', nonce: Date.now() });
      event.cancel('Opened Visual Library.');
      return;
    }

    const query = match[1].trim();
    const items = await getAllItems();
    const result = resolveMatches(items, query);

    if (result.type === 'missing-query') {
      event.cancel('Use /show <name> to display a visual reference.');
      tavo.utils.toast('Visual Library: use /show <name>.');
      return;
    }

    if (result.type === 'not-found') {
      event.cancel(`No visual library item found for "${query}".`);
      tavo.utils.toast(`Visual Library: no match for "${query}".`);
      return;
    }

    if (result.type === 'ambiguous') {
      const names = result.matches.slice(0, 5).map((item) => item.name).join(', ');
      event.cancel(`Multiple matches for "${query}": ${names}`);
      tavo.utils.toast(`Visual Library: multiple matches for "${query}".`);
      return;
    }

    try {
      await showEntryInChat(result.entry);
      event.cancel(`Displayed visual reference: ${result.entry.name}`);
    } catch (error) {
      console.error('[Tavo Visual Library] Failed to show entry from /show command:', error);
      event.cancel(`Failed to display visual reference: ${error.message || 'unknown error'}`);
      tavo.utils.toast('Visual Library: failed to display the requested image.');
    }
  });

  function simpleFingerprint(text) {
    const value = String(text || '');
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `${value.length}:${(hash >>> 0).toString(16)}`;
  }

  function pruneProcessedFingerprints() {
    const now = Date.now();
    for (const [key, timestamp] of processedFingerprints.entries()) {
      if (now - Number(timestamp || 0) >= AUTO_PROCESSED_WINDOW_MS) {
        processedFingerprints.delete(key);
      }
    }
  }

  function markFingerprintProcessed(fingerprint) {
    if (!fingerprint) return;
    pruneProcessedFingerprints();
    processedFingerprints.set(fingerprint, Date.now());
  }

  function isEntryOnCooldown(entry, history, currentCount, cooldown) {
    if (cooldown <= 0) return false;
    const lastCount = Number(history[autoHistoryKey(entry)]);
    return Number.isFinite(lastCount) && (currentCount - lastCount) < cooldown;
  }

  async function runSmartInvocation(content, options = {}) {
    const mode = String(options.mode || getConfig('autoShowMode', 'off'));
    if (mode === 'off') return { status: 'off', shown: [], matches: [] };

    const rawText = String(content || '');
    if (!rawText.trim() || rawText.includes('<!-- TVL_VISUAL_REFERENCE -->')) {
      return { status: 'ignored', shown: [], matches: [] };
    }

    const text = stripNonNarrativeSections(rawText);
    if (!text.trim()) return { status: 'no-narrative', shown: [], matches: [] };

    const fingerprint = options.fingerprint || simpleFingerprint(rawText);
    const useDedupe = !options.bypassDedupe;
    if (useDedupe) {
      pruneProcessedFingerprints();
      if (inFlightFingerprints.has(fingerprint) || processedFingerprints.has(fingerprint)) {
        return { status: 'duplicate', shown: [], matches: [] };
      }
      inFlightFingerprints.add(fingerprint);
    }

    try {
      const items = await getAllItems();
      if (!items.length) {
        if (useDedupe) markFingerprintProcessed(fingerprint);
        return { status: 'no-items', shown: [], matches: [] };
      }

      const matches = findAutoMatches(items, text, mode);
      if (!matches.length) {
        if (useDedupe) markFingerprintProcessed(fingerprint);
        return { status: 'no-match', shown: [], matches: [] };
      }

      const cooldown = Math.max(0, Number(getConfig('autoCooldownMessages', 10)) || 0);
      const maxPerMessage = Math.max(1, Math.min(3, Number(getConfig('autoMaxPerMessage', 1)) || 1));
      const history = getAutoHistory();
      const currentCount = await tavo.message.count();
      const eligible = options.bypassCooldown
        ? matches
        : matches.filter((match) => !isEntryOnCooldown(match.item, history, currentCount, cooldown));

      if (!eligible.length) {
        if (useDedupe) markFingerprintProcessed(fingerprint);
        return { status: 'cooldown', shown: [], matches };
      }

      const selected = eligible.slice(0, maxPerMessage);
      const shown = [];
      for (const match of selected) {
        await showEntryInChat(match.item, options.characterId || null);
        history[autoHistoryKey(match.item)] = await tavo.message.count();
        shown.push(match.item);
      }

      if (shown.length) setAutoHistory(history);
      if (useDedupe) markFingerprintProcessed(fingerprint);
      return { status: shown.length ? 'shown' : 'no-display', shown, matches };
    } finally {
      if (useDedupe) inFlightFingerprints.delete(fingerprint);
    }
  }

  function describeSmartResult(result) {
    if (!result) return 'Smart Invocation did not return a result.';
    if (result.status === 'shown') {
      return `Smart Invocation matched: ${result.shown.map((item) => item.name).join(', ')}`;
    }
    if (result.status === 'off') return 'Automatic visual display is Off in the plugin settings.';
    if (result.status === 'no-items') return 'No eligible visual-library entries are saved.';
    if (result.status === 'no-match') return 'No saved character/place name or alias was found in the last narrator reply.';
    if (result.status === 'cooldown') return 'Matching entries were found, but all are still inside the repeat cooldown.';
    if (result.status === 'duplicate') return 'That narrator reply was already checked.';
    return 'No image was displayed for the last narrator reply.';
  }

  tavo.plugin.on('sidebar:test-smart-invocation', async () => {
    try {
      const mode = String(getConfig('autoShowMode', 'off'));
      if (mode === 'off') {
        tavo.utils.toast('Automatic visual display is Off. Enable it in the plugin settings first.');
        return;
      }

      const lastNarrator = await getLastNarratorMessage();
      if (!lastNarrator) {
        tavo.utils.toast('No narrator reply was found to test.');
        return;
      }

      const result = await runSmartInvocation(lastNarrator.content, {
        mode,
        bypassCooldown: true,
        bypassDedupe: true,
        characterId: lastNarrator.characterId || null
      });
      tavo.utils.toast(describeSmartResult(result));
    } catch (error) {
      console.error('[Tavo Visual Library] Smart Invocation test failed:', error);
      tavo.utils.toast(`Smart Invocation test failed: ${error.message || 'unknown error'}`);
    }
  });

  // Primary trigger: message:added fires after the completed narrator reply is saved.
  // This provides the exact saved message and its characterId, and avoids racing the
  // narrator bubble with our visual-reference bubble.
  tavo.plugin.on('message:added', async (event) => {
    const message = event && event.message ? event.message : null;
    if (!message || message.role !== 'assistant') return;
    const content = String(message.content || '');
    if (!content || content.includes('<!-- TVL_VISUAL_REFERENCE -->')) return;

    try {
      await runSmartInvocation(content, {
        fingerprint: simpleFingerprint(content),
        characterId: message.characterId || null
      });
    } catch (error) {
      console.error('[Tavo Visual Library] Smart Invocation from message:added failed:', error);
    }
  });

  // Fallback for generation flows where a saved-message notification is delayed or
  // unavailable. The content fingerprint prevents a second image when message:added
  // has already completed the same reply.
  tavo.plugin.on('generation:success', async (event) => {
    const mode = String(getConfig('autoShowMode', 'off'));
    if (mode === 'off') return;
    const text = String(event && event.text || '');
    if (!text.trim()) return;
    const fingerprint = simpleFingerprint(text);

    setTimeout(() => {
      runSmartInvocation(text, { fingerprint }).catch((error) => {
        console.error('[Tavo Visual Library] Deferred Smart Invocation failed:', error);
      });
    }, 1200);
  });

})();
