/**
 * Regression tests for wire-to-port / wire-to-wire connections.
 *
 * Bug: wire drawing only supported port→port. Starting a wire ON an existing
 *      wire, or ending one ON an existing wire/junction, did nothing because
 *      completeWire() only handled 'port'/'junction' snap targets and rejected
 *      any non-port start as a floating endpoint.
 *
 * Fix: completeWire() now
 *   - resolves a 'wire' snap target by splitting it into a junction
 *     (facade.createJunctionOnWire) and connecting to that junction, and
 *   - materializes a deferred wire-tap START (self._wireFromTap) the same way.
 *
 * Test strategy: drive the exported completeWire() with a hand-rolled `self`
 * stub + a mock facade, asserting the facade calls it produces. This isolates
 * the connection-resolution decision logic (where the bug lived).
 */

import { describe, expect, it, vi } from 'vitest';
import { completeWire } from '../interactionWireHandlers';
import type { InteractionController } from '../InteractionController';

function makeFacade() {
  return {
    createJunctionOnWire: vi.fn((wireId: string, ..._rest: unknown[]) => `J(${wireId})`),
    addWire: vi.fn((..._args: unknown[]) => 'new-wire'),
  };
}

function makeSelf(facade: ReturnType<typeof makeFacade>): InteractionController {
  return {
    _facade: facade,
    _wireFrom: null,
    _wireFromTap: null,
    _wireFromExitDirection: null,
    _wireSnapTarget: null,
    _wireBendPoints: [],
    _wireDrawingReturnState: 'wire_mode',
    _wireDrawingFromPos: { x: 0, y: 0 },
    _state: 'wire_drawing',
    _lastMoveWorld: null,
    _onStateChange: undefined,
    _visuals: { clearWirePreview: vi.fn(), hidePortSnap: vi.fn() },
  } as unknown as InteractionController;
}

describe('wire tap connections (regression for wire→port / wire→wire)', () => {
  it('port → wire: splits the target wire and connects to the new junction', () => {
    const facade = makeFacade();
    const self = makeSelf(facade);
    self._wireFrom = { componentId: 'blkA', portId: 'out' };
    self._wireSnapTarget = { type: 'wire', id: 'wireX', position: { x: 50, y: 60 } };

    completeWire(self);

    expect(facade.createJunctionOnWire).toHaveBeenCalledWith('wireX', { x: 50, y: 60 });
    expect(facade.addWire).toHaveBeenCalledTimes(1);
    const [from, to] = facade.addWire.mock.calls[0];
    expect(from).toEqual({ componentId: 'blkA', portId: 'out' });
    expect(to).toEqual({ junctionId: 'J(wireX)' });
  });

  it('wire → port: materializes the deferred start tap, then connects to the port', () => {
    const facade = makeFacade();
    const self = makeSelf(facade);
    self._wireFromTap = { wireId: 'wireSrc', position: { x: 10, y: 20 } };
    self._wireSnapTarget = { type: 'port', id: 'in', parentId: 'blkB', position: { x: 90, y: 90 } };

    completeWire(self);

    expect(facade.createJunctionOnWire).toHaveBeenCalledWith('wireSrc', { x: 10, y: 20 });
    const [from, to] = facade.addWire.mock.calls[0];
    expect(from).toEqual({ junctionId: 'J(wireSrc)' });
    expect(to).toEqual({ componentId: 'blkB', portId: 'in' });
  });

  it('wire → wire: splits both wires and connects junction-to-junction', () => {
    const facade = makeFacade();
    const self = makeSelf(facade);
    self._wireFromTap = { wireId: 'wireSrc', position: { x: 10, y: 20 } };
    self._wireSnapTarget = { type: 'wire', id: 'wireDst', position: { x: 80, y: 40 } };

    completeWire(self);

    expect(facade.createJunctionOnWire).toHaveBeenCalledWith('wireSrc', { x: 10, y: 20 });
    expect(facade.createJunctionOnWire).toHaveBeenCalledWith('wireDst', { x: 80, y: 40 });
    const [from, to] = facade.addWire.mock.calls[0];
    expect(from).toEqual({ junctionId: 'J(wireSrc)' });
    expect(to).toEqual({ junctionId: 'J(wireDst)' });
  });

  it('floating start (empty canvas) still cannot complete — no wire created', () => {
    const facade = makeFacade();
    const self = makeSelf(facade);
    self._wireFrom = { position: { x: 5, y: 5 } };
    self._wireSnapTarget = { type: 'port', id: 'in', parentId: 'blkB', position: { x: 9, y: 9 } };

    completeWire(self);

    expect(facade.addWire).not.toHaveBeenCalled();
  });

  it('no snap target: nothing is created', () => {
    const facade = makeFacade();
    const self = makeSelf(facade);
    self._wireFrom = { componentId: 'blkA', portId: 'out' };
    self._wireSnapTarget = null;

    completeWire(self);

    expect(facade.addWire).not.toHaveBeenCalled();
  });
});
