import { describe, expect, it } from 'vitest';
import {
  canonicalUrl, captureKey, componentIdsOf, componentStyle, legacyFromSpec, normaliseSelection,
  provenanceFromLegacy, renderComponent, specFromLegacy, type CardSpec,
} from './entities.js';

const qa: CardSpec = { style: 'qa', question: 'Q?', answer: 'A' };
const bi: CardSpec = { style: 'qa_bidirectional', forward: { question: 'F?', answer: 'FA' }, reverse: { question: 'R?', answer: 'RA' } };
const list: CardSpec = {
  style: 'cloze_list', listName: 'Primary colours', items: ['red', 'blue', 'yellow'],
  prompts: [{ question: '___, blue, yellow', answer: 'red' }, { question: 'red, ___, yellow', answer: 'blue' }, { question: 'red, blue, ___', answer: 'yellow' }],
};

describe('components', () => {
  it('a simple card has one component, main', () => {
    expect(componentIdsOf(qa)).toEqual(['main']);
    expect(renderComponent(qa, 'main')).toEqual({ question: 'Q?', answer: 'A' });
  });
  it('a bidirectional card has forward and reverse', () => {
    expect(componentIdsOf(bi)).toEqual(['forward', 'reverse']);
    expect(renderComponent(bi, 'reverse')).toEqual({ question: 'R?', answer: 'RA' });
    expect(componentStyle(bi)).toBe('qa');
  });
  it('a list card has one component per prompt', () => {
    expect(componentIdsOf(list)).toEqual(['p0', 'p1', 'p2']);
    expect(renderComponent(list, 'p2').answer).toBe('yellow');
    expect(componentStyle(list)).toBe('cloze');
  });
  it('rendering a component the spec does not have throws', () => {
    expect(() => renderComponent(qa, 'forward')).toThrow(/does not exist/);
    expect(() => renderComponent(list, 'p9')).toThrow(/does not exist/);
  });
});

describe('legacy shape', () => {
  it('round-trips a numeric qa card', () => {
    const spec = specFromLegacy({ question: 'Boiling point?', answer: '100', style: 'qa', answerType: 'numeric', numericAnswer: 100, numericLower: 98, numericUpper: 102, numericUnit: '°C', numericPrecision: 0 });
    expect(spec).toMatchObject({ style: 'qa', answerType: 'numeric', numeric: { value: 100, unit: '°C' } });
    expect(legacyFromSpec(spec)).toMatchObject({ question: 'Boiling point?', answerType: 'numeric', numericAnswer: 100, numericLower: 98 });
  });
  it('an unknown style becomes qa; a composite flattens to its first component', () => {
    expect(specFromLegacy({ question: 'q', answer: 'a', style: 'qa_bidirectional' }).style).toBe('qa');
    expect(legacyFromSpec(bi)).toMatchObject({ question: 'F?', answer: 'FA', style: 'qa_bidirectional' });
  });
});

describe('capture keys', () => {
  it('ignore whitespace differences and depend on the source', () => {
    const a = captureKey('The  mitochondria\nis the powerhouse', 'https://x.test/p');
    const b = captureKey('The mitochondria is the powerhouse', 'https://x.test/p');
    const c = captureKey('The mitochondria is the powerhouse', 'https://x.test/other');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });
  it('normalise collapses runs of whitespace', () => {
    expect(normaliseSelection('  a \n\t b  ')).toBe('a b');
  });
});

describe('provenance', () => {
  it('canonicalUrl drops tracking params, fragments and trailing slashes', () => {
    expect(canonicalUrl('https://example.com/a/?utm_source=x&id=2#top')).toBe('https://example.com/a?id=2');
    expect(canonicalUrl('https://example.com/')).toBe('https://example.com/');
    expect(canonicalUrl('not a url')).toBe('not a url');
  });
  it('builds provenance from the flat source columns', () => {
    const p = provenanceFromLegacy({ sourceUrl: 'https://www.example.com/x?utm_medium=m', sourceTitle: 'Page', sourceSelection: 'quoted text', sourceContext: 'before the quoted text after it' });
    expect(p).toMatchObject({
      identifier: 'https://www.example.com/x', title: 'Page', containerTitle: 'example.com',
      selector: { type: 'TextQuote', exact: 'quoted text', prefix: 'before the', suffix: 'after it' },
    });
    expect(provenanceFromLegacy({})).toBeNull();
  });
  it('a non-URL source (a native app) keeps its identifier and has no url', () => {
    const p = provenanceFromLegacy({ sourceUrl: 'Notion - My page', sourceTitle: 'My page' });
    expect(p).toMatchObject({ identifier: 'Notion - My page', url: null, containerTitle: null });
  });
});
