/**
 * useProjectSheet
 *
 * Loads the active project's sheet document (.sheet.xml) for use
 * as a canvas overlay or other consumers.
 */

import { useEffect, useState } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { explorerService } from '../services/explorerService';
import { parseSheetXml } from '../services/sheetXmlService';
import type { SheetDocument } from '../types/sheet';

export function useProjectSheet(): SheetDocument | null {
  const currentProject = useProjectStore((s) => s.currentProject);
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const [sheetDoc, setSheetDoc] = useState<SheetDocument | null>(null);

  useEffect(() => {
    if (!currentProject || !projectPath) {
      setSheetDoc(null);
      return;
    }

    const sheetName = currentProject.config.sheet;
    if (!sheetName) {
      setSheetDoc(null);
      return;
    }

    // Derive project root from .mop file path
    const sep = projectPath.includes('\\') ? '\\' : '/';
    const parts = projectPath.split(sep);
    parts.pop(); // remove .mop filename
    const projectRoot = parts.join(sep);
    const sheetsDir = currentProject.config.directories?.sheets ?? 'sheets';
    const sheetPath = `${projectRoot}${sep}${sheetsDir}${sep}${sheetName}`;

    let cancelled = false;

    explorerService
      .readFileContents(sheetPath)
      .then((xml) => {
        if (!cancelled) {
          setSheetDoc(parseSheetXml(xml));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('Failed to load project sheet:', err);
          setSheetDoc(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentProject, projectPath]);

  return sheetDoc;
}
