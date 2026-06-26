// 자동 designation이 실제 배치 경로(document store/global)에서 동작하는지 통합 검증
import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useCanvasFacade } from '../../hooks/useCanvasFacade';
import { useDocumentRegistry } from '../documentRegistry';
import { useCanvasStore } from '../canvasStore';
import { useSettingsStore } from '../settingsStore';
import { defaultSettings } from '../../types/settings';
import type { SerializableCircuitState } from '../../components/OneCanvas/types';

function emptyCircuit(): SerializableCircuitState {
  return {
    version: '2.0',
    components: {},
    wires: [],
    metadata: { name: 'Designation Test', description: '', tags: [], version: '2.0' },
    viewport: { zoom: 1, panX: 0, panY: 0 },
    gridSize: 20,
    showGrid: true,
    gridStyle: 'dots',
    gridUnit: 'mm',
  };
}

beforeEach(() => {
  useDocumentRegistry.getState().reset();
  useCanvasStore.setState((state) => ({
    ...state,
    components: new Map(),
    junctions: new Map(),
    wires: [],
    gridSize: 20,
    snapToGrid: true,
    showGrid: true,
    gridStyle: 'dots',
  }));
  // 설정 override 초기화(기본표만 적용)
  useSettingsStore.setState({ settings: { ...defaultSettings, designationPrefixOverrides: {} } });
});

// 주입한 세 생성 경로: schematic 문서(OneCanvas 라이브) / canvas 문서 / global(deprecated)
const setups: ReadonlyArray<readonly [string, () => string | null]> = [
  ['schematic', () => useDocumentRegistry.getState().createDocument('schematic')],
  ['canvas', () => useDocumentRegistry.getState().createDocument('canvas')],
  ['global', () => null],
] as const;

describe.each(setups)('auto-designation (%s)', (_name, setupFn) => {
  it('같은 종류를 연달아 놓으면 K1, K2, K3로 증가한다', () => {
    const documentId = setupFn();
    const { result } = renderHook(() => useCanvasFacade(documentId));
    act(() => {
      result.current.loadCircuit(emptyCircuit());
    });

    const ids: string[] = [];
    // 배치마다 별도 act() — 실제 사용처럼 재렌더되어 직전 부품이 반영된다
    act(() => {
      ids.push(result.current.addComponent('relay', { x: 20, y: 20 }));
    });
    act(() => {
      ids.push(result.current.addComponent('relay', { x: 60, y: 20 }));
    });
    act(() => {
      ids.push(result.current.addComponent('relay', { x: 100, y: 20 }));
    });

    const designations = ids.map((id) => result.current.components.get(id)?.designation);
    expect(designations).toEqual(['K1', 'K2', 'K3']);
  });

  it('기존 최댓값+1 — 수동 K9를 보존하고 다음은 K10', () => {
    const documentId = setupFn();
    const { result } = renderHook(() => useCanvasFacade(documentId));
    act(() => {
      result.current.loadCircuit(emptyCircuit());
    });

    let manualId = '';
    let autoId = '';
    act(() => {
      manualId = result.current.addComponent('relay', { x: 20, y: 20 }, { designation: 'K9' });
    });
    act(() => {
      autoId = result.current.addComponent('relay', { x: 60, y: 20 });
    });

    expect(result.current.components.get(manualId)?.designation).toBe('K9'); // 보존
    expect(result.current.components.get(autoId)?.designation).toBe('K10'); // max+1
  });

  it('prefix 없는 종류(text)는 자동 넘버링하지 않는다', () => {
    const documentId = setupFn();
    const { result } = renderHook(() => useCanvasFacade(documentId));
    act(() => {
      result.current.loadCircuit(emptyCircuit());
    });

    let id = '';
    act(() => {
      id = result.current.addComponent('text', { x: 20, y: 20 });
    });

    const designation = result.current.components.get(id)?.designation;
    expect(designation === undefined || designation === '').toBe(true);
  });

  it('설정 override가 prefix를 바꾼다 (relay→KR)', () => {
    useSettingsStore.setState({
      settings: { ...defaultSettings, designationPrefixOverrides: { relay: 'KR' } },
    });
    const documentId = setupFn();
    const { result } = renderHook(() => useCanvasFacade(documentId));
    act(() => {
      result.current.loadCircuit(emptyCircuit());
    });

    let id = '';
    act(() => {
      id = result.current.addComponent('relay', { x: 20, y: 20 });
    });

    expect(result.current.components.get(id)?.designation).toBe('KR1');
  });
});
