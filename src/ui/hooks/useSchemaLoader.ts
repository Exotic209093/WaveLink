/**
 * Shared hook for loading Salesforce schema metadata.
 *
 * Loads describeGlobal on mount; loads describeSObject on demand.
 * Keeps a local Map so re-selecting an object is instant (in addition to background cache).
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import type { SObjectField, ChildRelationship } from '../../core/types/salesforce';
import type { SfApi } from '../api/sf';
import type { DescribeGlobalSObject } from '../../services/salesforce/api-client';

export interface SchemaLoaderResult {
  objects: DescribeGlobalSObject[];
  objectsLoading: boolean;
  fields: SObjectField[];
  fieldsLoading: boolean;
  childRelationships: ChildRelationship[];
  describedObject: string | null;
  loadFields: (objectName: string) => void;
  error: string | null;
}

export function useSchemaLoader(sf: SfApi, tabId?: number): SchemaLoaderResult {
  const [objects, setObjects] = useState<DescribeGlobalSObject[]>([]);
  const [objectsLoading, setObjectsLoading] = useState(false);
  const [fields, setFields] = useState<SObjectField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [childRelationships, setChildRelationships] = useState<ChildRelationship[]>([]);
  const [describedObject, setDescribedObject] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fieldsCacheRef = useRef(new Map<string, { fields: SObjectField[]; childRelationships: ChildRelationship[] }>());
  const loadingRef = useRef<string | null>(null);

  // Load objects once on mount
  useEffect(() => {
    setObjectsLoading(true);
    sf.describeGlobal(tabId)
      .then(res => {
        setObjects(res.sobjects.filter(o => o.queryable));
        setError(null);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load objects'))
      .finally(() => setObjectsLoading(false));
  }, [sf, tabId]);

  const loadFields = useCallback((objectName: string) => {
    if (!objectName) {
      setFields([]);
      setChildRelationships([]);
      setDescribedObject(null);
      return;
    }

    // Check local cache first
    const cached = fieldsCacheRef.current.get(objectName);
    if (cached) {
      setFields(cached.fields);
      setChildRelationships(cached.childRelationships);
      setDescribedObject(objectName);
      return;
    }

    // Prevent duplicate in-flight requests for the same object
    if (loadingRef.current === objectName) return;
    loadingRef.current = objectName;

    setFieldsLoading(true);
    setFields([]);
    setChildRelationships([]);
    sf.describeSObject(objectName, tabId)
      .then(desc => {
        const cr = desc.childRelationships ?? [];
        fieldsCacheRef.current.set(objectName, { fields: desc.fields, childRelationships: cr });
        // Only update UI if this is still the most recent request
        if (loadingRef.current === objectName) {
          setFields(desc.fields);
          setChildRelationships(cr);
          setDescribedObject(objectName);
          setError(null);
        }
      })
      .catch(e => {
        if (loadingRef.current === objectName) {
          setError(e instanceof Error ? e.message : 'Failed to load fields');
        }
      })
      .finally(() => {
        // Always clear loadingRef if it still matches, so the same object can be re-requested
        if (loadingRef.current === objectName) {
          loadingRef.current = null;
        }
        setFieldsLoading(false);
      });
  }, [sf, tabId]);

  return { objects, objectsLoading, fields, fieldsLoading, childRelationships, describedObject, loadFields, error };
}
