import { extractQueryParameters, renderParameterizedQuery } from '../../src/ui/utils/queryParameters';

describe('query parameters', () => {
  it('extracts unique names in display order', () => {
    expect(extractQueryParameters('WHERE OwnerId = {{ owner }} AND Status__c = {{status}} OR ParentId = {{owner}}'))
      .toEqual(['owner', 'status']);
  });

  it('renders values as escaped SOQL string literals', () => {
    expect(renderParameterizedQuery('WHERE Name = {{name}}', { name: "O'Reilly" }))
      .toBe("WHERE Name = 'O\\'Reilly'");
  });

  it('rejects missing values', () => {
    expect(() => renderParameterizedQuery('WHERE Id = {{recordId}}', {})).toThrow('Enter a value for recordId');
  });
});
