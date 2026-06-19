/**
 * TagImportResultDialog Component Tests
 *
 * Verifies the import progress indicator and result summary dialog
 * correctly displays processing state, success/partial results, and errors.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TagImportResultDialog } from '../TagImportResultDialog';
import type { ImportSummary } from '../../../../../types/tagImportExport';

describe('TagImportResultDialog', () => {
  const mockOnClose = vi.fn();

  const successResult: ImportSummary = {
    totalRows: 10,
    created: 8,
    overwritten: 2,
    skipped: 0,
    failed: 0,
    results: [
      { tagId: 'tag1', status: 'created' },
      { tagId: 'tag2', status: 'created' },
      { tagId: 'tag3', status: 'overwritten' },
    ],
  };

  const partialResult: ImportSummary = {
    totalRows: 10,
    created: 5,
    overwritten: 1,
    skipped: 2,
    failed: 2,
    results: [
      { tagId: 'tag1', status: 'created' },
      { tagId: 'tag2', status: 'failed', error: 'Invalid address format' },
      { tagId: 'tag3', status: 'failed', error: 'Unknown error' },
      { tagId: 'tag4', status: 'skipped' },
    ],
  };

  const skippedOnlyResult: ImportSummary = {
    totalRows: 3,
    created: 0,
    overwritten: 0,
    skipped: 3,
    failed: 0,
    results: [
      { tagId: 'tag1', status: 'skipped' },
      { tagId: 'tag2', status: 'skipped' },
      { tagId: 'tag3', status: 'skipped' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ==================== Visibility ====================

  it('does not render when isOpen is false', () => {
    render(
      <TagImportResultDialog
        isOpen={false}
        isProcessing={false}
        result={null}
        error={null}
        onClose={mockOnClose}
      />,
    );
    expect(screen.queryByTestId('tag-import-result-dialog')).not.toBeInTheDocument();
  });

  it('renders when isOpen is true', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={true}
        result={null}
        error={null}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByTestId('tag-import-result-dialog')).toBeInTheDocument();
  });

  // ==================== Processing State ====================

  it('shows progress indicator when processing', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={true}
        result={null}
        error={null}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByTestId('import-progress')).toBeInTheDocument();
    expect(screen.getByText('태그 가져오는 중...')).toBeInTheDocument();
  });

  it('does not show result summary while processing', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={true}
        result={null}
        error={null}
        onClose={mockOnClose}
      />,
    );
    expect(screen.queryByTestId('import-result-summary')).not.toBeInTheDocument();
  });

  it('does not allow closing via backdrop click while processing', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={true}
        result={null}
        error={null}
        onClose={mockOnClose}
      />,
    );
    fireEvent.click(screen.getByTestId('import-result-backdrop'));
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('does not allow closing via ESC while processing', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={true}
        result={null}
        error={null}
        onClose={mockOnClose}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  // ==================== Success Result State ====================

  it('shows success header when import is fully successful', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={false}
        result={successResult}
        error={null}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByText('가져오기 완료')).toBeInTheDocument();
  });

  it('shows total rows processed', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={false}
        result={successResult}
        error={null}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByText('총 10건 처리됨')).toBeInTheDocument();
  });

  it('shows created count', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={false}
        result={successResult}
        error={null}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByTestId('import-count-created')).toHaveTextContent('8');
  });

  it('shows overwritten count', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={false}
        result={successResult}
        error={null}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByTestId('import-count-overwritten')).toHaveTextContent('2');
  });

  it('shows skipped count', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={false}
        result={successResult}
        error={null}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByTestId('import-count-skipped')).toHaveTextContent('0');
  });

  it('shows failed count', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={false}
        result={successResult}
        error={null}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByTestId('import-count-failed')).toHaveTextContent('0');
  });

  it('does not show failed list when no failures', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={false}
        result={successResult}
        error={null}
        onClose={mockOnClose}
      />,
    );
    expect(screen.queryByTestId('import-failed-list')).not.toBeInTheDocument();
  });

  it('closes on done button click', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={false}
        result={successResult}
        error={null}
        onClose={mockOnClose}
      />,
    );
    fireEvent.click(screen.getByTestId('import-result-done-btn'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('closes on X button click', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={false}
        result={successResult}
        error={null}
        onClose={mockOnClose}
      />,
    );
    fireEvent.click(screen.getByTestId('import-result-close-btn'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('closes on backdrop click when not processing', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={false}
        result={successResult}
        error={null}
        onClose={mockOnClose}
      />,
    );
    fireEvent.click(screen.getByTestId('import-result-backdrop'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('closes on ESC key when not processing', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={false}
        result={successResult}
        error={null}
        onClose={mockOnClose}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // ==================== Partial Result State ====================

  it('shows partial completion header when there are failures', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={false}
        result={partialResult}
        error={null}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByText('가져오기 부분 완료')).toBeInTheDocument();
  });

  it('shows partial completion header when only skips', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={false}
        result={skippedOnlyResult}
        error={null}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByText('가져오기 부분 완료')).toBeInTheDocument();
  });

  it('shows correct counts for partial results', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={false}
        result={partialResult}
        error={null}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByTestId('import-count-created')).toHaveTextContent('5');
    expect(screen.getByTestId('import-count-overwritten')).toHaveTextContent('1');
    expect(screen.getByTestId('import-count-skipped')).toHaveTextContent('2');
    expect(screen.getByTestId('import-count-failed')).toHaveTextContent('2');
  });

  it('shows failed items list when there are failures', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={false}
        result={partialResult}
        error={null}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByTestId('import-failed-list')).toBeInTheDocument();
    expect(screen.getByText('tag2')).toBeInTheDocument();
    expect(screen.getByText('tag3')).toBeInTheDocument();
    expect(screen.getByText('Invalid address format')).toBeInTheDocument();
    expect(screen.getByText('Unknown error')).toBeInTheDocument();
  });

  it('shows failed detail section header', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={false}
        result={partialResult}
        error={null}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByText('실패 상세')).toBeInTheDocument();
  });

  // ==================== Error State ====================

  it('shows error state when error is set and no result', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={false}
        result={null}
        error="CSV 파일 형식이 올바르지 않습니다"
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByText('가져오기 실패')).toBeInTheDocument();
    expect(screen.getByTestId('import-error-message')).toHaveTextContent(
      'CSV 파일 형식이 올바르지 않습니다',
    );
  });

  it('shows close button in error state', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={false}
        result={null}
        error="Some error"
        onClose={mockOnClose}
      />,
    );
    fireEvent.click(screen.getByTestId('import-error-done-btn'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('shows X button in error state', () => {
    render(
      <TagImportResultDialog
        isOpen={true}
        isProcessing={false}
        result={null}
        error="Some error"
        onClose={mockOnClose}
      />,
    );
    fireEvent.click(screen.getByTestId('import-error-close-btn'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
