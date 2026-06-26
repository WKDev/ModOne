/**
 * XML Symbol Registry Initialization Hook
 *
 * Registers the built-in symbols into the global registry once per app session.
 *
 * Built-ins are authored as `.symbol.xml` and parsed into `BUILTIN_SYMBOLS` at
 * module load (see `assets/builtin-symbols`), so XML is already the single
 * source — there is no longer a separate "load XML overrides on top of the TS
 * definitions" pass. The registry's project/user-symbol layers are populated
 * elsewhere (`loadProjectXml`).
 *
 * Call once in App.tsx (or MainWindowContent) before any canvas document opens.
 *
 * Usage:
 *   function MainWindowContent() {
 *     useXmlSymbolInit();
 *     ...
 *   }
 */

import { useEffect, useRef } from 'react';
import { BUILTIN_SYMBOLS } from '@/assets/builtin-symbols';
import { xmlSymbolRegistry } from '@/services/xmlSymbolRegistry';

/**
 * Initialize the global XML symbol registry once per app session.
 * Safe to call multiple times — initialization only runs once.
 */
export function useXmlSymbolInit(): void {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || xmlSymbolRegistry.isInitialized) {
      return;
    }
    initialized.current = true;
    xmlSymbolRegistry.initBuiltins(BUILTIN_SYMBOLS);
  }, []);
}
