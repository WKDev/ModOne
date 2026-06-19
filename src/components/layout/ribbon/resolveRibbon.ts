import type {
  RibbonActionConfig,
  RibbonContext,
  RibbonGroupConfig,
  RibbonResolvedAction,
  RibbonResolvedGroup,
  RibbonResolvedTab,
  RibbonTabConfig,
} from './types';

function resolveFlag(
  value: boolean | ((context: RibbonContext) => boolean) | undefined,
  context: RibbonContext,
  defaultValue: boolean
): boolean {
  if (typeof value === 'function') {
    return value(context);
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return defaultValue;
}

function isActionVisible(action: RibbonActionConfig, context: RibbonContext): boolean {
  return resolveFlag(action.visible, context, true);
}

function isGroupVisible(group: RibbonGroupConfig, context: RibbonContext): boolean {
  return resolveFlag(group.visible, context, true);
}

function isTabVisible(tab: RibbonTabConfig, context: RibbonContext): boolean {
  return resolveFlag(tab.visible, context, true);
}

function resolveAction(action: RibbonActionConfig, context: RibbonContext): RibbonResolvedAction {
  return {
    id: action.id,
    label: action.label,
    commandId: action.commandId,
    icon: action.icon,
    dataTestId: action.dataTestId,
    disabled: resolveFlag(action.disabled, context, false),
    active: resolveFlag(action.active, context, false),
  };
}

function resolveGroup(group: RibbonGroupConfig, context: RibbonContext): RibbonResolvedGroup | null {
  if (!isGroupVisible(group, context)) {
    return null;
  }

  const actions = group.actions
    .filter((action) => isActionVisible(action, context))
    .map((action) => resolveAction(action, context));

  if (actions.length === 0) {
    return null;
  }

  return {
    id: group.id,
    title: group.title,
    actions,
  };
}

export function resolveRibbonTabs(config: RibbonTabConfig[], context: RibbonContext): RibbonResolvedTab[] {
  return config
    .filter((tab) => isTabVisible(tab, context))
    .map((tab) => {
      const groups = tab.groups
        .map((group) => resolveGroup(group, context))
        .filter((group): group is RibbonResolvedGroup => group !== null);

      return {
        id: tab.id,
        label: tab.label,
        groups,
      };
    })
    .filter((tab) => tab.groups.length > 0);
}
