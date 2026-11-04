import test from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../i18n/locales/en';
import { zh } from '../i18n/locales/zh';
import { DICTIONARY_MAP_ZH } from '../i18n/I18nContext';
import {
  calculateTrialBalance,
  convertCurrency,
  formatCurrency,
  SIMULATED_FX_RATES_TO_USD,
} from './finance';
import { INITIAL_JOURNAL_ENTRIES } from '../mocks/transactions';
import { JournalEntry } from '../types';

test('i18n: en and zh dictionaries have symmetric namespaces and keys', () => {
  const enKeys = Object.keys(en);
  const zhKeys = Object.keys(zh);
  assert.deepEqual(zhKeys.sort(), enKeys.sort(), 'Top-level i18n keys must match');

  for (const key of enKeys) {
    const enSub = (en as Record<string, unknown>)[key];
    const zhSub = (zh as Record<string, unknown>)[key];

    if (typeof enSub === 'object' && enSub !== null && !Array.isArray(enSub)) {
      assert.equal(typeof zhSub, 'object', `zh.${key} must be an object`);
      const enSubKeys = Object.keys(enSub as Record<string, unknown>).sort();
      const zhSubKeys = Object.keys((zhSub as Record<string, unknown>) || {}).sort();
      assert.deepEqual(zhSubKeys, enSubKeys, `Subkeys for namespace "${key}" must match`);
    }
  }
});

test('i18n: DICTIONARY_MAP_ZH resolves mock financial terms properly', () => {
  assert.equal(DICTIONARY_MAP_ZH['Interactive Brokers'], '盈透证券综合投资账户 (IBKR Pro)');
  assert.equal(DICTIONARY_MAP_ZH['Checking'], '活期 / 支票账户');
  assert.equal(DICTIONARY_MAP_ZH['Buy'], '买入证券');
  assert.equal(DICTIONARY_MAP_ZH['US Equities'], '美股权益');
  assert.equal(DICTIONARY_MAP_ZH['High'], '高风险');
  assert.equal(DICTIONARY_MAP_ZH['Accounting'], '复式记账模式');
});

test('finance: 4-currency conversion arithmetic with CNY', () => {
  assert.equal(SIMULATED_FX_RATES_TO_USD.CNY, 0.14);
  assert.equal(SIMULATED_FX_RATES_TO_USD.USD, 1.0);
  assert.equal(SIMULATED_FX_RATES_TO_USD.GBP, 1.285);
  assert.equal(SIMULATED_FX_RATES_TO_USD.EUR, 1.092);

  // 1000 CNY = 140 USD
  const cnyToUsd = convertCurrency(1000, 'CNY', 'USD');
  assert.equal(Math.round(cnyToUsd * 100) / 100, 140);

  // 140 USD = 1000 CNY
  const usdToCny = convertCurrency(140, 'USD', 'CNY');
  assert.equal(Math.round(usdToCny * 100) / 100, 1000);

  // Format CNY
  const formatted = formatCurrency(125000, 'CNY');
  assert.ok(formatted.includes('125,000') || formatted.includes('125000') || formatted.includes('¥'));
});

test('trial balance: official posted entries only by default (includePendingDrafts: false)', () => {
  const result = calculateTrialBalance(INITIAL_JOURNAL_ENTRIES, {
    includePendingDrafts: false,
  });

  assert.equal(result.includePendingDrafts, false);
  assert.equal(result.postedEntriesCount, 8);
  assert.equal(result.pendingDraftsCount, 2);
  assert.equal(result.isBalancedOverall, true, 'Official posted entries must be balanced');
  assert.equal(result.unbalancedEntryIds.length, 0);

  for (const leg of result.currencySummaries) {
    assert.equal(leg.isBalanced, true, `Currency leg ${leg.currency} must balance`);
    assert.ok(
      Math.abs(leg.residual) < 0.01,
      `Currency leg ${leg.currency} residual must be < 0.01`
    );
  }
});

test('trial balance: drafts included when includePendingDrafts: true', () => {
  const result = calculateTrialBalance(INITIAL_JOURNAL_ENTRIES, {
    includePendingDrafts: true,
  });

  assert.equal(result.includePendingDrafts, true);
  assert.equal(result.postedEntriesCount, 8);
  assert.equal(result.pendingDraftsCount, 2);
  assert.equal(result.isBalancedOverall, true);
});

test('trial balance: non-zero residual strictly sets isBalanced to false', () => {
  const badEntries: JournalEntry[] = [
    {
      id: 'JE-BAD-001',
      date: '2026-11-02',
      flag: '*',
      payee: 'Unbalanced Trade',
      narration: 'Deliberate imbalance for unit testing',
      status: 'Draft',
      sourceDocument: 'test_feed.json',
      rawBeancount: '2026-11-02 * "Unbalanced Trade"',
      postings: [
        { account: 'Assets:Banks:Checking:USBank', amount: 1000.0, currency: 'USD' },
        { account: 'Expenses:Unknown', amount: -900.0, currency: 'USD' }, // 100.00 USD residual!
      ],
    },
  ];

  const result = calculateTrialBalance(badEntries, { includePendingDrafts: true });
  assert.equal(result.isBalancedOverall, false, 'Unbalanced entry must fail overall balance');
  assert.deepEqual(result.unbalancedEntryIds, ['JE-BAD-001']);

  const usdLeg = result.currencySummaries.find((c) => c.currency === 'USD');
  assert.ok(usdLeg);
  assert.equal(usdLeg.isBalanced, false, 'USD leg must be marked as not balanced');
  assert.equal(Math.round(usdLeg.residual * 100) / 100, 100);
});
