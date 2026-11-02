'use client';

import { useMemo, useState } from 'react';
import { MAX_TAGS_PER_INVESTMENT, parseTagNames, tagKey } from '@/lib/tags';

export default function TagField({ value, onChange, suggestions = [] }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const selected = new Set(value.map((name) => tagKey(name)));
  const atLimit = value.length >= MAX_TAGS_PER_INVESTMENT;

  const matches = useMemo(() => {
    const query = tagKey(draft);
    return suggestions
      .map((item) => (typeof item === 'string' ? item : item?.name))
      .filter((name) => name && !selected.has(tagKey(name)))
      .filter((name) => !query || tagKey(name).includes(query))
      .slice(0, 8);
  }, [suggestions, draft, value]);

  function commitNames(names) {
    const pending = names.map((name) => String(name || '').trim()).filter(Boolean);
    if (!pending.length) {
      setDraft('');
      return;
    }
    try {
      onChange(parseTagNames([...value, ...pending]));
      setDraft('');
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  function onDraftChange(text) {
    if (!text.includes(',')) {
      setDraft(text);
      setError('');
      return;
    }
    const parts = text.split(',');
    commitNames(parts.slice(0, -1));
    setDraft(parts[parts.length - 1]);
  }

  return (
    <div>
      <label htmlFor="investment-tags" className="block text-xs text-ink-soft mb-1.5">
        Tags <span className="text-ink-mute">optional</span>
      </label>
      <div className="field-input flex flex-wrap items-center gap-1.5 min-h-[42px]">
        {value.map((name) => (
          <span key={tagKey(name)} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-plum-50 text-plum-600 border border-plum-600/30">
            {name}
            <button
              type="button"
              aria-label={`Remove ${name}`}
              onClick={() => onChange(value.filter((item) => tagKey(item) !== tagKey(name)))}
              className="text-plum-600/70 hover:text-plum-600 leading-none"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id="investment-tags"
          value={draft}
          disabled={atLimit}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commitNames([draft]);
            } else if (e.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (draft.trim()) commitNames([draft]);
          }}
          placeholder={atLimit ? `${MAX_TAGS_PER_INVESTMENT} tags is the limit` : (value.length ? '' : 'Marriage, Engagement…')}
          className="flex-1 min-w-[8rem] bg-transparent outline-none text-sm py-0.5 disabled:cursor-not-allowed"
        />
      </div>
      <p className="text-[11px] text-ink-mute mt-1">Filter or group investments and liquidity later. Press Enter after each tag.</p>
      {error && <p className="text-[11px] text-danger mt-1">{error}</p>}
      {matches.length > 0 && !atLimit && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {matches.map((name) => (
            <button
              key={tagKey(name)}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commitNames([name])}
              className="text-[11px] px-2 py-1 rounded-full border border-edge bg-paper-card text-ink-soft hover:border-plum-600"
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
