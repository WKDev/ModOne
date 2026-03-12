import { describe, expect, it } from 'vitest';

import { createBlockInstance } from '../../runtime/blockFactory';
import { createEmptyRuntimeState, setButtonState } from '../switchEvaluator';
import { simulateCircuit } from '../circuitSimulator';
import { evaluateBehaviorSwitch } from '../../runtime/behaviorTemplates';

import type { Wire } from '../../types';

function wire(id: string, fromComponentId: string, fromPortId: string, toComponentId: string, toPortId: string): Wire {
  return {
    id,
    from: { componentId: fromComponentId, portId: fromPortId },
    to: { componentId: toComponentId, portId: toPortId },
  };
}

describe('behavior archetypes', () => {
  it('stamps relay behavior metadata when a relay coil block is created', () => {
    const relayCoil = createBlockInstance('relay1', 'relay_coil', { x: 0, y: 0 }, { designation: 'K1' as never });

    expect(relayCoil.behavior).toMatchObject({
      templateId: 'archetype:relay',
      archetype: 'relay',
      deviceId: 'K1',
    });
    expect(relayCoil.visualState).toBe('deenergized');
  });

  it('evaluates relay contacts from derived device state', () => {
    const relayContact = createBlockInstance('contact1', 'relay_contact_no', { x: 0, y: 0 }, { designation: 'K1' as never });
    const runtimeState = createEmptyRuntimeState();
    runtimeState.deviceStates.set('K1', { energized: true });

    const switchState = evaluateBehaviorSwitch(relayContact, runtimeState);

    expect(switchState?.conducting).toBe(true);
    expect(switchState?.stateSource).toBe('relay');
  });

  it('lights a lamp through a pressed switch', () => {
    const source = createBlockInstance('ps1', 'powersource', { x: 0, y: 0 }, { polarity: 'positive' as never, voltage: 24 as never });
    const ground = createBlockInstance('gnd1', 'powersource', { x: 0, y: 80 }, { polarity: 'ground' as never, voltage: 0 as never });
    const pushButton = createBlockInstance('sw1', 'push_button_no', { x: 40, y: 0 }, { designation: 'S1' as never });
    const lamp = createBlockInstance('lamp1', 'pilot_lamp', { x: 80, y: 0 }, { designation: 'H1' as never });

    const runtimeState = setButtonState(createEmptyRuntimeState(), pushButton.id, true);
    const result = simulateCircuit(
      [source, ground, pushButton, lamp],
      [
        wire('w1', source.id, 'out', pushButton.id, 'in'),
        wire('w2', pushButton.id, 'out', lamp.id, 'in'),
        wire('w3', lamp.id, 'out', ground.id, 'in'),
      ],
      [],
      runtimeState,
    );

    expect(result.success).toBe(true);
    expect(result.poweredComponents.has(lamp.id)).toBe(true);
    expect(result.behaviorStates.get(lamp.id)?.lit).toBe(true);
  });

  it('closes a relay contact after the relay coil is energized', () => {
    const source = createBlockInstance('ps1', 'powersource', { x: 0, y: 0 }, { polarity: 'positive' as never, voltage: 24 as never });
    const ground = createBlockInstance('gnd1', 'powersource', { x: 0, y: 80 }, { polarity: 'ground' as never, voltage: 0 as never });
    const relayCoil = createBlockInstance('coil1', 'relay_coil', { x: 40, y: 0 }, { designation: 'K1' as never });
    const relayContact = createBlockInstance('contact1', 'relay_contact_no', { x: 80, y: 0 }, { designation: 'K1' as never });
    const lamp = createBlockInstance('lamp1', 'pilot_lamp', { x: 120, y: 0 }, { designation: 'H1' as never });

    const result = simulateCircuit(
      [source, ground, relayCoil, relayContact, lamp],
      [
        wire('w1', source.id, 'out', relayCoil.id, 'in'),
        wire('w2', relayCoil.id, 'out', ground.id, 'in'),
        wire('w3', source.id, 'out', relayContact.id, 'in'),
        wire('w4', relayContact.id, 'out', lamp.id, 'in'),
        wire('w5', lamp.id, 'out', ground.id, 'in'),
      ],
      [],
      createEmptyRuntimeState(),
    );

    expect(result.success).toBe(true);
    expect(result.resolvedRuntimeState.deviceStates.get('K1')?.energized).toBe(true);
    expect(result.switchStates.states.get(relayContact.id)?.isOpen).toBe(false);
    expect(result.behaviorStates.get(lamp.id)?.lit).toBe(true);
  });
});

