# WaveLink Migration Guide

A step-by-step guide for migrating data between Salesforce orgs using WaveLink.

---

## Overview

WaveLink supports full and incremental data migrations between Salesforce orgs. A typical migration workflow follows these steps:

1. Connect source and target orgs
2. Run schema gap analysis
3. Select objects and review dependency order
4. Configure field mappings
5. Set up transformation rules (optional)
6. Run pre-migration validation
7. Execute the migration
8. Run post-migration validation
9. Review and confirm (or rollback)

---

## 1. Connect Source and Target Orgs

1. Open a browser tab logged into your **source** Salesforce org
2. Open another tab logged into your **target** Salesforce org
3. Open WaveLink and click **Refresh** to detect both tabs
4. Both orgs should appear in the org switcher with PROD/SBX badges

**Tips:**
- Give each org a nickname (Settings > Org Management) for easy identification
- Colour dots help distinguish orgs at a glance
- You can connect sandbox, developer, and scratch orgs

---

## 2. Schema Gap Analysis

Before migrating, check that the target org's schema can receive the data:

1. Go to **Schema > Gap Analysis**
2. Select the source org and target org
3. Select the object to compare
4. Review the diff:
   - **Source only** — fields that exist in source but not target (data will be lost)
   - **Target only** — fields that exist in target but not source (will be null)
   - **Type mismatch** — fields with different types (may cause push errors)

**Action items:**
- Create missing fields in the target org before migration
- Note any type mismatches that need transformation rules
- Export the diff for documentation

---

## 3. Select Objects and Review Dependency Order

When migrating multiple objects:

1. Go to **Schema > Explorer** to visualise object relationships
2. Identify which objects have lookup or master-detail relationships
3. WaveLink automatically determines the migration order using topological sort:
   - Parent objects are migrated first
   - Child objects with lookups are migrated after their parents
   - Circular dependencies are detected and flagged

**Example order for a typical migration:**
```
1. Account          (no dependencies)
2. Contact          (depends on Account)
3. Opportunity      (depends on Account)
4. OpportunityContactRole  (depends on Contact + Opportunity)
```

---

## 4. Configure Field Mappings

For each object in the migration:

1. WaveLink auto-maps fields by matching API names
2. Review and adjust mappings for fields with different names across orgs
3. Mark fields to exclude (e.g., formula fields, auto-number fields)
4. Set default values for unmapped required fields

**Field mapping types:**
- **Direct** — source field maps to same-name target field
- **Renamed** — source field maps to a differently-named target field
- **Transformed** — source field is modified before push (uppercase, date format, etc.)
- **Static** — target field receives a fixed value for all records
- **Excluded** — field is not included in the migration

---

## 5. Transformation Rules (Optional)

If data needs to be modified during migration:

1. Go to **Data Ops > Pipeline** to build transformation steps
2. Common migration transformations:
   - **Filter** — exclude records by criteria (e.g., only active accounts)
   - **Transform** — modify field values (date formats, picklist value mapping)
   - **Lookup** — resolve lookup IDs to target org values
   - **Aggregate** — deduplicate or summarise before push

---

## 6. Pre-Migration Validation

Before executing:

1. Go to **Quality > Validation Rules**
2. Run data quality checks against the source data:
   - Required fields populated
   - Field values match expected formats (regex)
   - Picklist values exist in target org
   - Unique field constraints satisfied
3. Fix any issues in the source data before proceeding

---

## 7. Execute the Migration

1. Select **Data Ops > Push**
2. Choose the operation type:
   - **Insert** — create new records (most common for migration)
   - **Upsert** — insert or update by external ID (for incremental migration)
3. WaveLink automatically:
   - Pushes objects in dependency order
   - Captures inserted record IDs
   - Remaps lookup field values in subsequent objects (old ID → new ID)
   - Retries failed records with exponential backoff
4. Monitor progress in real-time

**API strategy selection:**
- **REST Collections** (default) — up to 200 records per request, best for < 10,000 records
- **Bulk API 2.0** — automatic for > 10,000 records, handles up to millions

---

## 8. Post-Migration Validation

After execution completes:

1. Go to **Cross-Org > Data Comparison**
2. Compare record counts: source vs target for each migrated object
3. Spot-check field values on sample records
4. Verify lookup relationships are intact (IDs remapped correctly)
5. Check for systematic issues (null fields that shouldn't be null, truncated values)

---

## 9. Rollback (If Needed)

If the migration needs to be undone:

1. Go to **History > Audit Trail**
2. Find the migration push entries
3. Click **Undo** to delete all inserted records
4. For multi-object migrations, rollback in reverse order (children before parents)

**Important:**
- Rollback only works for insert operations (deletes the inserted records)
- Update operations cannot be fully rolled back (original values are not captured yet)
- Rollback must respect referential integrity — delete child records before parents

---

## Best Practices

### Before Migration
- Always test in a **sandbox** before migrating to production
- Document your migration plan (objects, order, field mappings, filters)
- Save your configuration as a **migration template** for replay
- Run schema gap analysis to catch issues early
- Back up target org data if the migration includes updates

### During Migration
- Monitor API usage limits (Settings > API Usage Dashboard)
- Keep batch sizes reasonable (200 for REST, 10,000 for Bulk)
- Don't close the browser during execution

### After Migration
- Validate record counts match expectations
- Spot-check lookup relationships
- Test business processes in the target org (triggers, flows, validation rules)
- Export the ID map for reference
- Keep the migration template for future use

---

## Troubleshooting

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `REQUIRED_FIELD_MISSING` | Target org has a required field not in the source data | Add field to mapping with a default value |
| `DUPLICATE_VALUE` | Unique field constraint violated | Filter out duplicates before push, or use upsert |
| `INVALID_CROSS_REFERENCE_KEY` | Lookup ID doesn't exist in target org | Ensure parent objects are migrated first |
| `FIELD_INTEGRITY_EXCEPTION` | Lookup relationship constraint | Check dependency order; parent must be pushed before child |
| `STRING_TOO_LONG` | Source field value exceeds target field length | Add a transformation to truncate |
| `INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST` | Picklist value doesn't exist in target | Add missing values to target picklist, or map values |
| Rate limit (429) | Too many API calls | WaveLink auto-retries with backoff; reduce batch parallelism if persistent |

### Getting Help

- Check the [Troubleshooting Guide](TROUBLESHOOTING.md)
- Open an issue on [GitHub](https://github.com/jc-wave/wave-link/issues)
