/**
 * Shared hook for loading Salesforce schema metadata.
 *
 * Loads describeGlobal on mount; loads describeSObject on demand.
 * Keeps a local Map so re-selecting an object is instant (in addition to background cache).
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import type { SObjectField } from '../../core/types/salesforce';
import type { SfApi } from '../api/sf';
import type { DescribeGlobalSObject } from '../../services/salesforce/api-client';

export interface SchemaLoaderResult {
  objects: DescribeGlobalSObject[];
  objectsLoading: boolean;
  fields: SObjectField[];
  fieldsLoading: boolean;
  describedObject: string | null;
  loadFields: (objectName: string) => void;
  error: string | null;
}

export function useSchemaLoader(sf: SfApi, tabId?: number): SchemaLoaderResult {
  const [objects, setObjects] = useState<DescribeGlobalSObject[]>([]);
  const [objectsLoading, setObjectsLoading] = useState(false);
  const [fields, setFields] = useState<SObjectField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [describedObject, setDescribedObject] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fieldsCacheRef = useRef(new Map<string, SObjectField[]>());
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
      setDescribedObject(null);
      return;
    }

    // Check local cache first
    const cached = fieldsCacheRef.current.get(objectName);
    if (cached) {
      setFields(cached);
      setDescribedObject(objectName);
      return;
    }

    // Prevent duplicate requests for the same object
    if (loadingRef.current === objectName) return;
    loadingRef.current = objectName;

    setFieldsLoading(true);
    sf.describeSObject(objectName, tabId)
      .then(desc => {
        fieldsCacheRef.current.set(objectName, desc.fields);
        // Only update if this is still the requested object
        if (loadingRef.current === objectName) {
          setFields(desc.fields);
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
        if (loadingRef.current === objectName) {
          loadingRef.current = null;
          setFieldsLoading(false);
        }
      });
  }, [sf, tabId]);

  return { objects, objectsLoading, fields, fieldsLoading, describedObject, loadFields, error };
}
