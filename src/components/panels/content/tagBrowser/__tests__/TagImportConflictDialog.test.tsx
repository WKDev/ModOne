/**
 * TagImportConflictDialog Component Tests
 *
 * Verifies the import conflict resolution dialog presents
 * overwrite/skip/abort options and handles user selections correctly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TagImportConflictDialog } from '../TagImportConflictDialog';
import type { ImportConflict, ConflictResolution } from '../../../../../types/tagImportExport';

describe('TagImportConflictDialog', () => {
  const mockOnResolve = vi.fn<(resolution: ConflictResolution) => void>();
  const mockOnCancel = vi.fn();

  const sampleConflicts: ImportConflict[] = [
    {
      tagId: 'tag_motor_1',
      conflictType: 'duplicateTagId',
      message: 'Tag ID "tag_motor_1" already exists in registry',
    },
    {
      tagId: 'tag_sensor_2',
      conflictType: 'duplicateAddress',
      message: 'Device address "DataWord:100" already used by existing tag',
    },
    {
      tagId: 'tag_valve_3',
      conflictType: 'internalDuplicateTagId',
      message: 'Duplicate tag ID within import file',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('does not render when isOpen is false', () => {
    render(
      <TagImportConflictDialog
        isOpen={false}
        conflicts={sampleConflicts}
        onResolve={mockOnResolve}
        onCancel={mockOnCancel}
      />,
    );
    expect(screen.queryByTestId('tag-import-conflict-dialog')).not.toBeInTheDocument();
  });

  it('does not render when conflicts is empty', () => {
    render(
      <TagImportConflictDialog
        isOpen={true}
        conflicts={[]}
        onResolve={mockOnResolve}
        onCancel={mockOnCancel}
      />,
    );
    expect(screen.queryByTestId('tag-import-conflict-dialog')).not.toBeInTheDocument();
  });

  it('renders when open with conflicts', () => {
    render(
      <TagImportConflictDialog
        isOpen={true}
        conflicts={sampleConflicts}
        onResolve={mockOnResolve}
        onCancel={mockOnCancel}
      />,
    );
    expect(screen.getByTestId('tag-import-conflict-dialog')).toBeInTheDocument();
  });

  it('displays conflict count', () => {
    render(
      <TagImportConflictDialog
        isOpen={true}
        conflicts={sampleConflicts}
        onResolve={mockOnResolve}
        onCancel={mockOnCancel}
      />,
    );
    expect(screen.getByText('3건의 충돌이 발견되었습니다')).toBeInTheDocument();
  });

  it('displays conflicting tag IDs', () => {
    render(
      <TagImportConflictDialog
        isOpen={true}
        conflicts={sampleConflicts}
        onResolve={mockOnResolve}
        onCancel={mockOnCancel}
      />,
    );
    expect(screen.getByText('tag_motor_1')).toBeInTheDocument();
    expect(screen.getByText('tag_sensor_2')).toBeInTheDocument();
    expect(screen.getByText('tag_valve_3')).toBeInTheDocument();
  });

  it('shows all three action buttons', () => {
    render(
      <TagImportConflictDialog
        isOpen={true}
        conflicts={sampleConflicts}
        onResolve={mockOnResolve}
        onCancel={mockOnCancel}
      />,
    );
    expect(screen.getByTestId('conflict-overwrite-btn')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-skip-btn')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-abort-btn')).toBeInTheDocument();
  });

  it('calls onResolve("overwrite") when overwrite is clicked', () => {
    render(
      <TagImportConflictDialog
        isOpen={true}
        conflicts={sampleConflicts}
        onResolve={mockOnResolve}
        onCancel={mockOnCancel}
      />,
    );
    fireEvent.click(screen.getByTestId('conflict-overwrite-btn'));
    expect(mockOnResolve).toHaveBeenCalledWith('overwrite');
    expect(mockOnResolve).toHaveBeenCalledTimes(1);
  });

  it('calls onResolve("skip") when skip is clicked', () => {
    render(
      <TagImportConflictDialog
        isOpen={true}
        conflicts={sampleConflicts}
        onResolve={mockOnResolve}
        onCancel={mockOnCancel}
      />,
    );
    fireEvent.click(screen.getByTestId('conflict-skip-btn'));
    expect(mockOnResolve).toHaveBeenCalledWith('skip');
    expect(mockOnResolve).toHaveBeenCalledTimes(1);
  });

  it('calls onResolve("abort") when abort is clicked', () => {
    render(
      <TagImportConflictDialog
        isOpen={true}
        conflicts={sampleConflicts}
        onResolve={mockOnResolve}
        onCancel={mockOnCancel}
      />,
    );
    fireEvent.click(screen.getByTestId('conflict-abort-btn'));
    expect(mockOnResolve).toHaveBeenCalledWith('abort');
    expect(mockOnResolve).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when ESC key is pressed', () => {
    render(
      <TagImportConflictDialog
        isOpen={true}
        conflicts={sampleConflicts}
        onResolve={mockOnResolve}
        onCancel={mockOnCancel}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when backdrop is clicked', () => {
    render(
      <TagImportConflictDialog
        isOpen={true}
        conflicts={sampleConflicts}
        onResolve={mockOnResolve}
        onCancel={mockOnCancel}
      />,
    );
    fireEvent.click(screen.getByTestId('conflict-dialog-backdrop'));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('separates registry conflicts from internal conflicts', () => {
    render(
      <TagImportConflictDialog
        isOpen={true}
        conflicts={sampleConflicts}
        onResolve={mockOnResolve}
        onCancel={mockOnCancel}
      />,
    );
    // Registry conflicts section should exist
    expect(screen.getByTestId('conflict-list-registry')).toBeInTheDocument();
    // Internal conflicts section should exist
    expect(screen.getByTestId('conflict-list-internal')).toBeInTheDocument();
  });

  it('shows only registry section when no internal conflicts', () => {
    const registryOnly: ImportConflict[] = [
      { tagId: 'tag1', conflictType: 'duplicateTagId', message: 'exists' },
    ];
    render(
      <TagImportConflictDialog
        isOpen={true}
        conflicts={registryOnly}
        onResolve={mockOnResolve}
        onCancel={mockOnCancel}
      />,
    );
    expect(screen.getByTestId('conflict-list-registry')).toBeInTheDocument();
    expect(screen.queryByTestId('conflict-list-internal')).not.toBeInTheDocument();
  });

  it('displays conflict type labels correctly', () => {
    render(
      <TagImportConflictDialog
        isOpen={true}
        conflicts={sampleConflicts}
        onResolve={mockOnResolve}
        onCancel={mockOnCancel}
      />,
    );
    // "태그 ID 중복" appears in both registry and internal sections (as substring of "파일 내 태그 ID 중복")
    const tagIdLabels = screen.getAllByText(/태그 ID 중복/);
    expect(tagIdLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/디바이스 주소 중복/)).toBeInTheDocument();
  });

  it('shows resolution explanation text', () => {
    render(
      <TagImportConflictDialog
        isOpen={true}
        conflicts={sampleConflicts}
        onResolve={mockOnResolve}
        onCancel={mockOnCancel}
      />,
    );
    expect(screen.getByText('처리 방법을 선택하세요:')).toBeInTheDocument();
    // Button labels appear in both explanation text and buttons
    const overwriteElements = screen.getAllByText('덮어쓰기');
    expect(overwriteElements.length).toBeGreaterThanOrEqual(1);
    const skipElements = screen.getAllByText('건너뛰기');
    expect(skipElements.length).toBeGreaterThanOrEqual(1);
  });
});
