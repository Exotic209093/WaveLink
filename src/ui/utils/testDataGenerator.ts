/**
 * Test data generator that maps Salesforce field types to realistic fake values.
 * Complexity: O(N*F) where N=record count, F=fields per record.
 */

export interface GeneratorConfig {
  fieldName: string;
  fieldType: string;
  override?: 'auto' | 'static' | 'formula';
  staticValue?: string;
  formulaTemplate?: string;
  picklistValues?: string[];
  nullable?: boolean;
  nullRate?: number;
}

export interface RelationshipConfig {
  fieldName: string;
  lookupValues: string[];
}

// Simple seeded pseudo-random for reproducible test data
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const FIRST_NAMES = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
const COMPANIES = ['Acme Corp', 'Globex', 'Initech', 'Umbrella Corp', 'Stark Industries', 'Wayne Enterprises', 'Oscorp', 'LexCorp', 'Cyberdyne Systems', 'Soylent Corp'];
const STREETS = ['Main St', 'Oak Ave', 'Elm Dr', 'Park Blvd', 'Cedar Ln', 'Maple Rd', 'Pine Way', 'Lake Dr', 'Hill St', 'River Rd'];
const CITIES = ['Springfield', 'Portland', 'Austin', 'Denver', 'Seattle', 'Chicago', 'Miami', 'Boston', 'Atlanta', 'Dallas'];
const STATES = ['CA', 'TX', 'NY', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI'];
const DOMAINS = ['example.com', 'test.org', 'demo.net', 'sample.io', 'fake.co'];

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

/** Generate a single field value based on Salesforce field type. O(1). */
export function generateFieldValue(
  config: GeneratorConfig,
  rowIndex: number,
  rand: () => number,
): unknown {
  if (config.nullable && config.nullRate && rand() < config.nullRate) return null;

  if (config.override === 'static' && config.staticValue !== undefined) return config.staticValue;
  if (config.override === 'formula' && config.formulaTemplate) {
    return config.formulaTemplate.replace(/\{rowIndex\}/g, String(rowIndex));
  }

  const type = config.fieldType.toLowerCase();
  const name = config.fieldName.toLowerCase();

  // Name-aware generation
  if (name === 'firstname' || name === 'first_name') return pick(FIRST_NAMES, rand);
  if (name === 'lastname' || name === 'last_name') return pick(LAST_NAMES, rand);
  if (name === 'name' || name === 'fullname') return `${pick(FIRST_NAMES, rand)} ${pick(LAST_NAMES, rand)}`;
  if (name === 'company' || name === 'companyname' || name === 'account') return pick(COMPANIES, rand);
  if (name.includes('street') || name.includes('address')) return `${Math.floor(rand() * 9999) + 1} ${pick(STREETS, rand)}`;
  if (name.includes('city')) return pick(CITIES, rand);
  if (name.includes('state')) return pick(STATES, rand);
  if (name.includes('zip') || name.includes('postal')) return String(10000 + Math.floor(rand() * 89999));

  switch (type) {
    case 'string':
    case 'textarea':
      return `Sample ${config.fieldName} ${rowIndex + 1}`;
    case 'email':
      return `${pick(FIRST_NAMES, rand).toLowerCase()}.${pick(LAST_NAMES, rand).toLowerCase()}${Math.floor(rand() * 100)}@${pick(DOMAINS, rand)}`;
    case 'phone':
      return `(${Math.floor(rand() * 900) + 100}) ${Math.floor(rand() * 900) + 100}-${Math.floor(rand() * 9000) + 1000}`;
    case 'url':
      return `https://www.${pick(DOMAINS, rand)}/${config.fieldName.toLowerCase()}`;
    case 'boolean':
      return rand() > 0.5;
    case 'int':
    case 'integer':
      return Math.floor(rand() * 10000);
    case 'double':
    case 'currency':
    case 'percent':
      return Math.round(rand() * 10000) / 100;
    case 'date':
      { const d = new Date(Date.now() - Math.floor(rand() * 365 * 24 * 60 * 60 * 1000));
        return d.toISOString().split('T')[0]; }
    case 'datetime':
      { const dt = new Date(Date.now() - Math.floor(rand() * 365 * 24 * 60 * 60 * 1000));
        return dt.toISOString(); }
    case 'picklist':
    case 'multipicklist':
      if (config.picklistValues && config.picklistValues.length > 0) return pick(config.picklistValues, rand);
      return `Option ${Math.floor(rand() * 5) + 1}`;
    case 'reference':
      return null; // handled by RelationshipConfig
    case 'id':
      return undefined; // Salesforce assigns
    default:
      return `Value ${rowIndex + 1}`;
  }
}

/** Generate a complete record from field configs. O(F). */
export function generateRecord(
  configs: GeneratorConfig[],
  relationships: RelationshipConfig[],
  rowIndex: number,
  rand: () => number,
): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const config of configs) {
    const val = generateFieldValue(config, rowIndex, rand);
    if (val !== undefined) record[config.fieldName] = val;
  }
  for (const rel of relationships) {
    if (rel.lookupValues.length > 0) {
      record[rel.fieldName] = rel.lookupValues[rowIndex % rel.lookupValues.length];
    }
  }
  return record;
}

/** Generate a full dataset. O(N*F). */
export function generateDataset(
  configs: GeneratorConfig[],
  relationships: RelationshipConfig[],
  count: number,
  seed?: number,
): Record<string, unknown>[] {
  const rand = seededRandom(seed ?? Date.now());
  const records: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    records.push(generateRecord(configs, relationships, i, rand));
  }
  return records;
}
