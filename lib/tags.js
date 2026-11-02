export const MAX_TAGS_PER_INVESTMENT = 8;
export const MAX_TAG_LENGTH = 40;

export function tagKey(name) {
  return String(name || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-IN');
}

export function normalizeTagName(value) {
  const name = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!name) {
    const err = new Error('Enter a tag name.');
    err.status = 400;
    throw err;
  }
  if (name.length > MAX_TAG_LENGTH) {
    const err = new Error(`Tag names can be at most ${MAX_TAG_LENGTH} characters.`);
    err.status = 400;
    throw err;
  }
  if (/[\u0000-\u001f]/.test(name)) {
    const err = new Error('Tag names cannot include line breaks.');
    err.status = 400;
    throw err;
  }
  return name;
}

export function parseTagNames(input) {
  if (!Array.isArray(input)) {
    const err = new Error('Tags must be a list of names.');
    err.status = 400;
    throw err;
  }
  const names = [];
  const seen = new Set();
  for (const raw of input) {
    const source = typeof raw === 'string' ? raw : raw?.name;
    if (source == null || String(source).trim() === '') continue;
    const name = normalizeTagName(source);
    const key = tagKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  if (names.length > MAX_TAGS_PER_INVESTMENT) {
    const err = new Error(`An investment can have at most ${MAX_TAGS_PER_INVESTMENT} tags.`);
    err.status = 400;
    throw err;
  }
  return names;
}

export function readOptionalTagNames(body) {
  if (!body || !Object.prototype.hasOwnProperty.call(body, 'tags')) return undefined;
  return parseTagNames(body.tags);
}

export function investmentTags(investment) {
  const tags = [];
  const seen = new Set();
  for (const raw of investment?.tags || []) {
    const name = typeof raw === 'string' ? raw : raw?.name;
    const key = tagKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    tags.push({
      id: (typeof raw === 'object' && raw?.id) || key,
      name: String(name).replace(/\s+/g, ' ').trim(),
    });
  }
  return tags;
}

export function hasTag(investment, name) {
  const key = tagKey(name);
  if (!key) return false;
  return investmentTags(investment).some((tag) => tagKey(tag.name) === key);
}

export function groupInvestmentsByTag(investments) {
  const groups = new Map();
  const untagged = [];
  for (const investment of investments || []) {
    const tags = investmentTags(investment);
    if (!tags.length) {
      untagged.push(investment);
      continue;
    }
    for (const tag of tags) {
      const key = tagKey(tag.name);
      if (!groups.has(key)) groups.set(key, { key, name: tag.name, items: [] });
      groups.get(key).items.push(investment);
    }
  }
  const sections = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
  if (untagged.length) sections.push({ key: '__untagged', name: 'No tag', items: untagged });
  return sections;
}

export function summarizeTags(investments, { amountOf, isLiquidity }) {
  const map = new Map();
  for (const investment of investments || []) {
    const amount = Number(amountOf(investment)) || 0;
    const liquidity = Boolean(isLiquidity(investment));
    for (const tag of investmentTags(investment)) {
      const key = tagKey(tag.name);
      if (!map.has(key)) {
        map.set(key, { key, name: tag.name, count: 0, invested: 0, liquidity: 0 });
      }
      const row = map.get(key);
      row.count += 1;
      if (liquidity) row.liquidity += amount;
      else row.invested += amount;
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}
