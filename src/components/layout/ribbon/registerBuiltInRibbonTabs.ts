import { BUILT_IN_RIBBON_TABS } from './config';
import { ribbonRegistry } from './ribbonRegistry';

let builtInTabsRegistered = false;

export function ensureBuiltInRibbonTabsRegistered(): void {
  if (builtInTabsRegistered) {
    return;
  }

  ribbonRegistry.registerAll(BUILT_IN_RIBBON_TABS);
  builtInTabsRegistered = true;
}

export function resetBuiltInRibbonTabsRegistration(): void {
  builtInTabsRegistered = false;
}
