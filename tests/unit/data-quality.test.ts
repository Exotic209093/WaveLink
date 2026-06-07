import { inferQualityRules, scoreDataset } from '../../src/ui/utils/dataQuality';

describe('inferQualityRules', () => {
  it('adds a completeness rule for every column', () => {
    const rules = inferQualityRules(['Name', 'Amount']);
    const required = rules.filter(r => r.type === 'required');
    expect(required.map(r => r.field)).toEqual(['Name', 'Amount']);
    expect(required.every(r => r.severity === 'warning')).toBe(true);
  });

  it('adds an email format rule for email-like columns', () => {
    const rules = inferQualityRules(['Email']);
    const fmt = rules.find(r => r.type === 'format');
    expect(fmt).toBeDefined();
    expect(fmt!.severity).toBe('error');
    expect(String(fmt!.config.pattern)).toContain('@');
  });

  it('adds url and phone format rules from column-name hints', () => {
    const rules = inferQualityRules(['Website', 'MobilePhone']);
    expect(rules.some(r => r.id.startsWith('infer-url-'))).toBe(true);
    expect(rules.some(r => r.id.startsWith('infer-phone-'))).toBe(true);
  });

  it('ignores blank header names', () => {
    expect(inferQualityRules(['', '  '])).toHaveLength(0);
  });
});

describe('inferQualityRules + scoreDataset', () => {
  it('scores a fully-populated dataset at 100', () => {
    const records = [
      { Name: 'Acme', Email: 'a@acme.com' },
      { Name: 'Globex', Email: 'b@globex.com' },
    ];
    const rules = inferQualityRules(['Name', 'Email']);
    const result = scoreDataset(records, rules);
    expect(result.score).toBe(100);
    expect(result.failedChecks).toBe(0);
    expect(result.warningChecks).toBe(0);
  });

  it('penalizes missing values as warnings, not hard failures', () => {
    const records = [
      { Name: 'Acme', Email: 'a@acme.com' },
      { Name: '', Email: 'b@globex.com' }, // missing Name
    ];
    const rules = inferQualityRules(['Name', 'Email']);
    const result = scoreDataset(records, rules);
    expect(result.score).toBeLessThan(100);
    expect(result.warningChecks).toBe(1); // the empty Name
    expect(result.failedChecks).toBe(0);
  });

  it('flags malformed emails as hard failures but lets empty emails pass format', () => {
    const records = [
      { Name: 'Acme', Email: 'not-an-email' }, // bad format -> error
      { Name: 'Globex', Email: '' },           // empty -> only completeness warning
    ];
    const rules = inferQualityRules(['Name', 'Email']);
    const result = scoreDataset(records, rules);
    expect(result.failedChecks).toBe(1); // the malformed email
    expect(result.warningChecks).toBe(1); // the empty email's completeness rule
  });
});
