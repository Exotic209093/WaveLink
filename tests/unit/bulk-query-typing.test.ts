/**
 * Bulk query results must export the same JSON types as REST (#80).
 *
 * Bulk API 2.0 returns CSV, so every value is a string. Types come from the queried object's
 * describe — never from guessing at the CSV text, which corrupted Text fields in PR #119.
 */

import {
  resolveBulkFieldTypes,
  typeBulkQueryPage,
  typeBulkQueryValue,
} from '../../src/services/salesforce/bulk-query-typing';
import type { SObjectDescribe, SObjectField, SalesforceFieldType } from '../../src/core/types/salesforce';

function field(name: string, type: SalesforceFieldType, extra: Partial<SObjectField> = {}): SObjectField {
  return {
    name, label: name, type, length: 0, required: false, createable: true, updateable: true,
    nillable: true, defaultValue: null, externalId: false, unique: false, ...extra,
  };
}

function sobject(name: string, fields: SObjectField[]): SObjectDescribe {
  return {
    name, label: name, labelPlural: name, keyPrefix: null, custom: false,
    createable: true, updateable: true, deletable: true, fields,
  };
}

const DESCRIBES: Record<string, SObjectDescribe> = {
  Contact: sobject('Contact', [
    field('Id', 'id'),
    field('MailingPostalCode', 'string'),
    field('External_Id__c', 'string'),
    field('Flag_Text__c', 'string'),
    field('Big_Number_Text__c', 'textarea'),
    field('Is_Active__c', 'boolean'),
    field('Employees__c', 'int'),
    field('Revenue__c', 'currency'),
    field('Score__c', 'double'),
    field('Discount__c', 'percent'),
    field('Birthdate', 'date'),
    field('LastModifiedDate', 'datetime'),
    field('AccountId', 'reference', { referenceTo: ['Account'], relationshipName: 'Account' }),
    field('WhatId', 'reference', { referenceTo: ['Account', 'Opportunity'], relationshipName: 'What' }),
  ]),
  Account: sobject('Account', [
    field('Name', 'string'),
    field('AnnualRevenue', 'currency'),
    field('IsPartner', 'boolean'),
    field('OwnerId', 'reference', { referenceTo: ['User'], relationshipName: 'Owner' }),
  ]),
  User: sobject('User', [
    field('Name', 'string'),
    field('IsActive', 'boolean'),
  ]),
};

const describe_ = jest.fn(async (name: string) => DESCRIBES[name] ?? null);

beforeEach(() => describe_.mockClear());

describe('Bulk query values typed from describe', () => {
  it('keeps Text values that only look numeric or boolean as strings', async () => {
    const [record] = await typeBulkQueryPage([{
      Id: '003xx0000000001AAA',
      MailingPostalCode: '02134',
      External_Id__c: '123456789012345678',
      Flag_Text__c: 'true',
      Big_Number_Text__c: '-5',
    }], 'Contact', describe_);

    expect(record).toEqual({
      Id: '003xx0000000001AAA',
      MailingPostalCode: '02134',
      External_Id__c: '123456789012345678',
      Flag_Text__c: 'true',
      Big_Number_Text__c: '-5',
    });
  });

  it('types boolean and numeric fields like REST does', async () => {
    const [record] = await typeBulkQueryPage([{
      Is_Active__c: 'true',
      Employees__c: '42',
      Revenue__c: '500000.0',
      Score__c: '-12.75',
      Discount__c: '15',
    }], 'Contact', describe_);

    expect(record).toEqual({
      Is_Active__c: true,
      Employees__c: 42,
      Revenue__c: 500000,
      Score__c: -12.75,
      Discount__c: 15,
    });
  });

  it('keeps dates and datetimes as the strings REST returns', async () => {
    const [record] = await typeBulkQueryPage([{
      Birthdate: '1990-04-01',
      LastModifiedDate: '2026-10-04T12:00:00.000Z',
    }], 'Contact', describe_);

    expect(record).toEqual({ Birthdate: '1990-04-01', LastModifiedDate: '2026-10-04T12:00:00.000Z' });
  });

  it('maps empty cells to null, matching REST', async () => {
    const [record] = await typeBulkQueryPage([{
      MailingPostalCode: '', Is_Active__c: '', Revenue__c: '', Unknown__c: '',
    }], 'Contact', describe_);

    expect(record).toEqual({ MailingPostalCode: null, Is_Active__c: null, Revenue__c: null, Unknown__c: null });
  });

  it('keeps numeric values as strings when a JS number would lose precision', () => {
    expect(typeBulkQueryValue('123456789012345678', 'int')).toBe('123456789012345678');
    expect(typeBulkQueryValue('1234567890123456.78', 'currency')).toBe('1234567890123456.78');
    expect(typeBulkQueryValue('0.1234567890123456789', 'double')).toBe('0.1234567890123456789');
    expect(typeBulkQueryValue('123456789012345.0000', 'currency')).toBe(123456789012345);
    expect(typeBulkQueryValue('9007199254740991', 'int')).toBe(9007199254740991);
  });

  it('leaves malformed values as strings instead of producing NaN or coercing', () => {
    expect(typeBulkQueryValue('abc', 'double')).toBe('abc');
    expect(typeBulkQueryValue('1.5', 'int')).toBe('1.5');
    expect(typeBulkQueryValue('yes', 'boolean')).toBe('yes');
    expect(typeBulkQueryValue('.', 'double')).toBe('.');
  });

  it('resolves relationship columns through referenceTo describes', async () => {
    const [record] = await typeBulkQueryPage([{
      'Account.Name': '00123',
      'Account.AnnualRevenue': '250000',
      'account.ispartner': 'false',
      'Account.Owner.IsActive': 'true',
      'Account.Owner.Name': 'true',
    }], 'Contact', describe_);

    expect(record).toEqual({
      'Account.Name': '00123',
      'Account.AnnualRevenue': 250000,
      'account.ispartner': false,
      'Account.Owner.IsActive': true,
      'Account.Owner.Name': 'true',
    });
    // Each object is described once per page, however many columns reference it.
    expect(describe_.mock.calls.map(([name]) => name).sort()).toEqual(['Account', 'Contact', 'User']);
  });

  it('leaves polymorphic and unresolvable relationship columns as strings', async () => {
    const types = await resolveBulkFieldTypes('Contact', ['What.Name', 'Nope.Amount', 'Account.Missing__c'], describe_);
    expect(types).toEqual({ 'What.Name': undefined, 'Nope.Amount': undefined, 'Account.Missing__c': undefined });
  });

  it('falls back to strings when the queried object or describe is unavailable', async () => {
    const failing = jest.fn(async () => {
      throw new Error('describe failed');
    });
    expect(await typeBulkQueryPage([{ Employees__c: '42', Name: '' }], 'Contact', failing))
      .toEqual([{ Employees__c: '42', Name: null }]);
    expect(await typeBulkQueryPage([{ Employees__c: '42' }], undefined, describe_))
      .toEqual([{ Employees__c: '42' }]);
  });
});
