import { fieldDisplay } from '../../src/ui/utils/fieldDisplay';

describe('fieldDisplay', () => {
  it('shows label and API name together when they differ', () => {
    expect(fieldDisplay({ name: 'Name', label: 'Account Name' })).toBe('Account Name (Name)');
  });

  it('falls back to the API name when label is identical', () => {
    expect(fieldDisplay({ name: 'Name', label: 'Name' })).toBe('Name');
  });

  it('falls back to the API name when label is missing or blank', () => {
    expect(fieldDisplay({ name: 'CustomField__c' })).toBe('CustomField__c');
    expect(fieldDisplay({ name: 'CustomField__c', label: '   ' })).toBe('CustomField__c');
  });
});
