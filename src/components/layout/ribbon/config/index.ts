import type { RibbonTabConfig } from '../types';
import { canvasRibbonTab } from './canvasRibbonTab';
import { ladderRibbonTab } from './ladderRibbonTab';
import { scenarioRibbonTab } from './scenarioRibbonTab';
import { integrationRibbonTab } from './integrationRibbonTab';
import { layoutRibbonTab } from './layoutRibbonTab';

export const BUILT_IN_RIBBON_TABS: RibbonTabConfig[] = [
  canvasRibbonTab,
  ladderRibbonTab,
  scenarioRibbonTab,
  integrationRibbonTab,
  layoutRibbonTab,
];

export {
  canvasRibbonTab,
  ladderRibbonTab,
  scenarioRibbonTab,
  integrationRibbonTab,
  layoutRibbonTab,
};
