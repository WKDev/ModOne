import type { RibbonTabConfig } from '../types';

export const ladderRibbonTab: RibbonTabConfig = {
  id: 'ladder',
  label: 'Ladder',
  groups: [
    {
      id: 'ladder-contacts',
      title: 'Contacts',
      actions: [
        { id: 'ladder-contact-no', label: 'NO', commandId: 'ladder.addContactNO', icon: 'square' },
        { id: 'ladder-contact-nc', label: 'NC', commandId: 'ladder.addContactNC', icon: 'unplug' },
        { id: 'ladder-contact-p', label: 'P Edge', commandId: 'ladder.addContactP', icon: 'arrowUpFromLine' },
        { id: 'ladder-contact-n', label: 'N Edge', commandId: 'ladder.addContactN', icon: 'arrowDownToLine' },
      ],
    },
    {
      id: 'ladder-logic',
      title: 'Logic',
      actions: [
        { id: 'ladder-logic-coil', label: 'Coil', commandId: 'ladder.addCoil', icon: 'circle' },
        { id: 'ladder-logic-set', label: 'SET', commandId: 'ladder.addCoilSet', icon: 'gitBranch' },
        { id: 'ladder-logic-wire-h', label: 'H Wire', commandId: 'ladder.addWireH', icon: 'workflow' },
        { id: 'ladder-logic-wire-v', label: 'V Wire', commandId: 'ladder.addWireV', icon: 'network' },
      ],
    },
    {
      id: 'ladder-edit',
      title: 'Edit',
      actions: [
        { id: 'ladder-edit-cut', label: 'Cut', commandId: 'ladder.cutSelection', icon: 'scissors' },
        { id: 'ladder-edit-copy', label: 'Copy', commandId: 'ladder.copySelection', icon: 'box' },
        { id: 'ladder-edit-paste', label: 'Paste', commandId: 'ladder.pasteFromClipboard', icon: 'fileDown' },
        { id: 'ladder-edit-delete', label: 'Delete', commandId: 'ladder.deleteSelected', icon: 'trash2' },
      ],
    },
  ],
};
