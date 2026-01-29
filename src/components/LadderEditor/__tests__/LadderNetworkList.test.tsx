/**
 * LadderNetworkList Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LadderNetworkList } from '../LadderNetworkList';
import { useLadderStore } from '../../../stores/ladderStore';
import type { LadderNetwork } from '../../../types/ladder';

// Helper to create mock networks
function createMockNetwork(id: string, label?: string): LadderNetwork {
  return {
    id,
    label,
    elements: new Map(),
    wires: [],
    enabled: true,
  };
}

describe('LadderNetworkList', () => {
  beforeEach(() => {
    // Reset store before each test
    act(() => {
      useLadderStore.setState({
        networks: new Map(),
        currentNetworkId: null,
        selectedElementIds: new Set(),
        clipboard: [],
        gridConfig: {
          columns: 10,
          cellWidth: 80,
          cellHeight: 60,
          showGridLines: true,
          snapToGrid: true,
        },
        mode: 'edit',
        monitoringState: null,
        history: [],
        historyIndex: -1,
        isDirty: false,
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders empty state when no networks', () => {
    render(<LadderNetworkList />);

    expect(screen.getByText('No networks')).toBeInTheDocument();
    expect(screen.getByText('0 network(s)')).toBeInTheDocument();
  });

  it('renders network list with networks', () => {
    const network1 = createMockNetwork('net-1', 'Network 1');
    const network2 = createMockNetwork('net-2', 'Network 2');

    act(() => {
      useLadderStore.setState({
        networks: new Map([
          ['net-1', network1],
          ['net-2', network2],
        ]),
        currentNetworkId: 'net-1',
      });
    });

    render(<LadderNetworkList />);

    expect(screen.getByText('Network 1')).toBeInTheDocument();
    expect(screen.getByText('Network 2')).toBeInTheDocument();
    expect(screen.getByText('2 network(s)')).toBeInTheDocument();
  });

  it('highlights selected network', () => {
    const network1 = createMockNetwork('net-1', 'Network 1');
    const network2 = createMockNetwork('net-2', 'Network 2');

    act(() => {
      useLadderStore.setState({
        networks: new Map([
          ['net-1', network1],
          ['net-2', network2],
        ]),
        currentNetworkId: 'net-1',
      });
    });

    render(<LadderNetworkList />);

    const selectedItem = screen.getByText('Network 1').closest('[role="button"]');
    expect(selectedItem).toHaveClass('bg-blue-600');

    const unselectedItem = screen.getByText('Network 2').closest('[role="button"]');
    expect(unselectedItem).not.toHaveClass('bg-blue-600');
  });

  it('selects network on click', () => {
    const network1 = createMockNetwork('net-1', 'Network 1');
    const network2 = createMockNetwork('net-2', 'Network 2');

    act(() => {
      useLadderStore.setState({
        networks: new Map([
          ['net-1', network1],
          ['net-2', network2],
        ]),
        currentNetworkId: 'net-1',
      });
    });

    render(<LadderNetworkList />);

    const network2Item = screen.getByText('Network 2').closest('[role="button"]');
    fireEvent.click(network2Item!);

    expect(useLadderStore.getState().currentNetworkId).toBe('net-2');
  });

  it('calls onNetworkSelect callback when network selected', () => {
    const network1 = createMockNetwork('net-1', 'Network 1');
    const onNetworkSelect = vi.fn();

    act(() => {
      useLadderStore.setState({
        networks: new Map([['net-1', network1]]),
        currentNetworkId: null,
      });
    });

    render(<LadderNetworkList onNetworkSelect={onNetworkSelect} />);

    const networkItem = screen.getByText('Network 1').closest('[role="button"]');
    fireEvent.click(networkItem!);

    expect(onNetworkSelect).toHaveBeenCalledWith('net-1');
  });

  it('adds new network when Add button clicked', () => {
    act(() => {
      useLadderStore.setState({
        networks: new Map(),
        currentNetworkId: null,
      });
    });

    render(<LadderNetworkList />);

    fireEvent.click(screen.getByText('Add Network'));

    expect(useLadderStore.getState().networks.size).toBe(1);
  });

  it('shows element count badge', () => {
    const network = createMockNetwork('net-1', 'Network 1');
    network.elements.set('el-1', {
      id: 'el-1',
      type: 'contact_no',
      position: { row: 0, col: 0 },
      address: 'M0000',
      properties: {},
    });
    network.elements.set('el-2', {
      id: 'el-2',
      type: 'coil',
      position: { row: 0, col: 9 },
      address: 'M0001',
      properties: {},
    });

    act(() => {
      useLadderStore.setState({
        networks: new Map([['net-1', network]]),
        currentNetworkId: 'net-1',
      });
    });

    render(<LadderNetworkList />);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('hides delete button when only one network', () => {
    const network = createMockNetwork('net-1', 'Network 1');

    act(() => {
      useLadderStore.setState({
        networks: new Map([['net-1', network]]),
        currentNetworkId: 'net-1',
      });
    });

    render(<LadderNetworkList />);

    // Delete button should not be visible (no X icon with title "Delete network")
    expect(screen.queryByTitle('Delete network')).not.toBeInTheDocument();
  });

  it('shows delete button when multiple networks', () => {
    const network1 = createMockNetwork('net-1', 'Network 1');
    const network2 = createMockNetwork('net-2', 'Network 2');

    act(() => {
      useLadderStore.setState({
        networks: new Map([
          ['net-1', network1],
          ['net-2', network2],
        ]),
        currentNetworkId: 'net-1',
      });
    });

    render(<LadderNetworkList />);

    // Both delete buttons should exist
    expect(screen.getAllByTitle('Delete network')).toHaveLength(2);
  });

  it('edits label on double-click', async () => {
    const network = createMockNetwork('net-1', 'Network 1');

    act(() => {
      useLadderStore.setState({
        networks: new Map([['net-1', network]]),
        currentNetworkId: 'net-1',
      });
    });

    render(<LadderNetworkList />);

    const label = screen.getByText('Network 1');
    fireEvent.doubleClick(label);

    // Input should appear
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('Network 1');

    // Change value and blur
    await userEvent.clear(input);
    await userEvent.type(input, 'New Label');
    fireEvent.blur(input);

    // Label should be updated in store
    const updatedNetwork = useLadderStore.getState().networks.get('net-1');
    expect(updatedNetwork?.label).toBe('New Label');
  });

  it('cancels edit on Escape', async () => {
    const network = createMockNetwork('net-1', 'Original Label');

    act(() => {
      useLadderStore.setState({
        networks: new Map([['net-1', network]]),
        currentNetworkId: 'net-1',
      });
    });

    render(<LadderNetworkList />);

    const label = screen.getByText('Original Label');
    fireEvent.doubleClick(label);

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'Changed');
    await userEvent.keyboard('{Escape}');

    // Label should not be changed
    expect(screen.getByText('Original Label')).toBeInTheDocument();
  });

  it('saves edit on Enter', async () => {
    const network = createMockNetwork('net-1', 'Network 1');

    act(() => {
      useLadderStore.setState({
        networks: new Map([['net-1', network]]),
        currentNetworkId: 'net-1',
      });
    });

    render(<LadderNetworkList />);

    const label = screen.getByText('Network 1');
    fireEvent.doubleClick(label);

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'Saved Label{Enter}');

    const updatedNetwork = useLadderStore.getState().networks.get('net-1');
    expect(updatedNetwork?.label).toBe('Saved Label');
  });

  it('hides add button when showAddButton is false', () => {
    render(<LadderNetworkList showAddButton={false} />);

    expect(screen.queryByText('Add Network')).not.toBeInTheDocument();
  });

  describe('Drag and Drop Reordering', () => {
    it('renders drag handles for each network', () => {
      const network1 = createMockNetwork('net-1', 'Network 1');
      const network2 = createMockNetwork('net-2', 'Network 2');

      act(() => {
        useLadderStore.setState({
          networks: new Map([
            ['net-1', network1],
            ['net-2', network2],
          ]),
          currentNetworkId: 'net-1',
        });
      });

      render(<LadderNetworkList />);

      // Drag handles contain SVG elements with grip pattern (6 circles)
      const svgs = document.querySelectorAll('svg');
      // Each network item has a drag handle SVG
      expect(svgs.length).toBeGreaterThanOrEqual(2);
    });

    it('reorders networks when store action is called', () => {
      const network1 = createMockNetwork('net-1', 'Network 1');
      const network2 = createMockNetwork('net-2', 'Network 2');
      const network3 = createMockNetwork('net-3', 'Network 3');

      act(() => {
        useLadderStore.setState({
          networks: new Map([
            ['net-1', network1],
            ['net-2', network2],
            ['net-3', network3],
          ]),
          currentNetworkId: 'net-1',
        });
      });

      // Verify initial order
      let networkIds = Array.from(useLadderStore.getState().networks.keys());
      expect(networkIds).toEqual(['net-1', 'net-2', 'net-3']);

      // Reorder: move network at index 0 to index 2
      act(() => {
        useLadderStore.getState().reorderNetworks(0, 2);
      });

      // Verify new order
      networkIds = Array.from(useLadderStore.getState().networks.keys());
      expect(networkIds).toEqual(['net-2', 'net-3', 'net-1']);
    });

    it('maintains selection after reorder', () => {
      const network1 = createMockNetwork('net-1', 'Network 1');
      const network2 = createMockNetwork('net-2', 'Network 2');

      act(() => {
        useLadderStore.setState({
          networks: new Map([
            ['net-1', network1],
            ['net-2', network2],
          ]),
          currentNetworkId: 'net-1',
        });
      });

      // Reorder networks
      act(() => {
        useLadderStore.getState().reorderNetworks(0, 1);
      });

      // Selection should be maintained
      expect(useLadderStore.getState().currentNetworkId).toBe('net-1');
    });

    it('renders networks in correct order after reorder', () => {
      const network1 = createMockNetwork('net-1', 'First');
      const network2 = createMockNetwork('net-2', 'Second');
      const network3 = createMockNetwork('net-3', 'Third');

      act(() => {
        useLadderStore.setState({
          networks: new Map([
            ['net-1', network1],
            ['net-2', network2],
            ['net-3', network3],
          ]),
          currentNetworkId: 'net-1',
        });
      });

      const { rerender } = render(<LadderNetworkList />);

      // Initial order - verify by text content order in DOM
      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();

      // Verify DOM order
      const container = document.body;
      const firstPos = container.innerHTML.indexOf('First');
      const secondPos = container.innerHTML.indexOf('Second');
      const thirdPos = container.innerHTML.indexOf('Third');
      expect(firstPos).toBeLessThan(secondPos);
      expect(secondPos).toBeLessThan(thirdPos);

      // Reorder: move first to last
      act(() => {
        useLadderStore.getState().reorderNetworks(0, 2);
      });

      rerender(<LadderNetworkList />);

      // Verify new DOM order
      const containerAfter = document.body;
      const firstPosAfter = containerAfter.innerHTML.indexOf('First');
      const secondPosAfter = containerAfter.innerHTML.indexOf('Second');
      const thirdPosAfter = containerAfter.innerHTML.indexOf('Third');
      expect(secondPosAfter).toBeLessThan(thirdPosAfter);
      expect(thirdPosAfter).toBeLessThan(firstPosAfter);
    });
  });
});
