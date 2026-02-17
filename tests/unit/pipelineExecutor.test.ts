import { executeStep, executePipeline } from '../../src/ui/utils/pipelineExecutor';
import type { PipelineStep } from '../../src/ui/utils/pipelineExecutor';

describe('executeStep', () => {
  describe('filter step', () => {
    it('filters records where field equals value', () => {
      const records = [
        { Name: 'Alice', Status: 'Active' },
        { Name: 'Bob', Status: 'Inactive' },
        { Name: 'Carol', Status: 'Active' },
      ];
      const step: PipelineStep = {
        id: 's1',
        type: 'filter',
        label: 'Active only',
        config: { field: 'Status', operator: 'eq', value: 'Active' },
      };
      const result = executeStep(records, step);

      expect(result).toHaveLength(2);
      expect(result.every(r => r.Status === 'Active')).toBe(true);
    });

    it('filters records using isEmpty operator', () => {
      const records = [
        { Name: 'Alice', Phone: '' },
        { Name: 'Bob', Phone: '555-0100' },
        { Name: 'Carol', Phone: '  ' },
      ];
      const step: PipelineStep = {
        id: 's1',
        type: 'filter',
        label: 'No phone',
        config: { field: 'Phone', operator: 'isEmpty', value: '' },
      };
      const result = executeStep(records, step);

      expect(result).toHaveLength(2);
      expect(result.map(r => r.Name)).toContain('Alice');
      expect(result.map(r => r.Name)).toContain('Carol');
    });
  });

  describe('transform step', () => {
    it('replaces {Field} tokens with field values', () => {
      const records = [
        { FirstName: 'Alice', LastName: 'Smith' },
        { FirstName: 'Bob', LastName: 'Jones' },
      ];
      const step: PipelineStep = {
        id: 's1',
        type: 'transform',
        label: 'Full name',
        config: { field: 'FullName', expression: '{FirstName} {LastName}' },
      };
      const result = executeStep(records, step);

      expect(result[0].FullName).toBe('Alice Smith');
      expect(result[1].FullName).toBe('Bob Jones');
    });
  });

  describe('aggregate step', () => {
    it('groups by field and computes sum aggregation', () => {
      const records = [
        { Region: 'East', Amount: 100 },
        { Region: 'West', Amount: 200 },
        { Region: 'East', Amount: 150 },
        { Region: 'West', Amount: 50 },
      ];
      const step: PipelineStep = {
        id: 's1',
        type: 'aggregate',
        label: 'Sum by region',
        config: {
          groupBy: ['Region'],
          aggregations: [{ field: 'Amount', fn: 'sum', outputField: 'TotalAmount' }],
        },
      };
      const result = executeStep(records, step);

      expect(result).toHaveLength(2);
      const east = result.find(r => r.Region === 'East');
      const west = result.find(r => r.Region === 'West');
      expect(east?.TotalAmount).toBe(250);
      expect(west?.TotalAmount).toBe(250);
    });

    it('computes count aggregation', () => {
      const records = [
        { Status: 'Active', Id: '1' },
        { Status: 'Active', Id: '2' },
        { Status: 'Inactive', Id: '3' },
      ];
      const step: PipelineStep = {
        id: 's1',
        type: 'aggregate',
        label: 'Count by status',
        config: {
          groupBy: ['Status'],
          aggregations: [{ field: 'Id', fn: 'count', outputField: 'Count' }],
        },
      };
      const result = executeStep(records, step);

      expect(result).toHaveLength(2);
      const active = result.find(r => r.Status === 'Active');
      const inactive = result.find(r => r.Status === 'Inactive');
      expect(active?.Count).toBe(2);
      expect(inactive?.Count).toBe(1);
    });
  });

  describe('join step', () => {
    it('inner join returns only matched records', () => {
      const records = [
        { AccountId: 'A1', Name: 'Contact1' },
        { AccountId: 'A2', Name: 'Contact2' },
        { AccountId: 'A3', Name: 'Contact3' },
      ];
      const rightRecords = [
        { Id: 'A1', AccountName: 'Acme' },
        { Id: 'A3', AccountName: 'Initech' },
      ];
      const step: PipelineStep = {
        id: 's1',
        type: 'join',
        label: 'Join accounts',
        config: {
          joinField: 'AccountId',
          rightRecords,
          rightJoinField: 'Id',
          joinType: 'inner',
        },
      };
      const result = executeStep(records, step);

      expect(result).toHaveLength(2);
      expect(result[0].AccountName).toBe('Acme');
      expect(result[1].AccountName).toBe('Initech');
    });

    it('left join returns all records with extra fields for matches', () => {
      const records = [
        { AccountId: 'A1', Name: 'Contact1' },
        { AccountId: 'A2', Name: 'Contact2' },
      ];
      const rightRecords = [
        { Id: 'A1', AccountName: 'Acme' },
      ];
      const step: PipelineStep = {
        id: 's1',
        type: 'join',
        label: 'Left join accounts',
        config: {
          joinField: 'AccountId',
          rightRecords,
          rightJoinField: 'Id',
          joinType: 'left',
        },
      };
      const result = executeStep(records, step);

      expect(result).toHaveLength(2);
      expect(result[0].AccountName).toBe('Acme');
      expect(result[1].AccountName).toBeUndefined();
    });
  });
});

describe('executePipeline', () => {
  it('executes a two-step pipeline (filter then transform)', () => {
    const records = [
      { Name: 'Alice', Status: 'Active', Greeting: '' },
      { Name: 'Bob', Status: 'Inactive', Greeting: '' },
      { Name: 'Carol', Status: 'Active', Greeting: '' },
    ];
    const steps: PipelineStep[] = [
      {
        id: 'step1',
        type: 'filter',
        label: 'Active only',
        config: { field: 'Status', operator: 'eq', value: 'Active' },
      },
      {
        id: 'step2',
        type: 'transform',
        label: 'Greeting',
        config: { field: 'Greeting', expression: 'Hello {Name}!' },
      },
    ];
    const { result } = executePipeline(records, steps);

    expect(result).toHaveLength(2);
    expect(result[0].Greeting).toBe('Hello Alice!');
    expect(result[1].Greeting).toBe('Hello Carol!');
  });

  it('captures step outputs for each step', () => {
    const records = [
      { Name: 'Alice', Status: 'Active' },
      { Name: 'Bob', Status: 'Inactive' },
    ];
    const steps: PipelineStep[] = [
      {
        id: 'filter_step',
        type: 'filter',
        label: 'Active only',
        config: { field: 'Status', operator: 'eq', value: 'Active' },
      },
      {
        id: 'transform_step',
        type: 'transform',
        label: 'Greeting',
        config: { field: 'Msg', expression: 'Hi {Name}' },
      },
    ];
    const { stepOutputs } = executePipeline(records, steps);

    expect(stepOutputs['filter_step']).toHaveLength(1);
    expect(stepOutputs['transform_step']).toHaveLength(1);
    expect(stepOutputs['transform_step'][0].Msg).toBe('Hi Alice');
  });

  it('returns input unchanged for an empty pipeline', () => {
    const records = [
      { Name: 'Alice' },
      { Name: 'Bob' },
    ];
    const { result, stepOutputs } = executePipeline(records, []);

    expect(result).toEqual(records);
    expect(Object.keys(stepOutputs)).toHaveLength(0);
  });
});
