/**
 * useTagImportExportDialogs Hook Tests
 *
 * Verifies that import/export file dialogs use the correct file extensions,
 * filter names, default filenames, and MIME type labels per format.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTagImportExportDialogs } from '../useTagImportExportDialogs';

// ============================================================================
// Mocks
// ============================================================================

const mockOpen = vi.fn();
const mockSave = vi.fn();
const mockReadTextFile = vi.fn();
const mockWriteTextFile = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastWarning = vi.fn();

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: (...args: unknown[]) => mockOpen(...args),
  save: (...args: unknown[]) => mockSave(...args),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: (...args: unknown[]) => mockReadTextFile(...args),
  writeTextFile: (...args: unknown[]) => mockWriteTextFile(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
  },
}));

const mockExportCsv = vi.fn();
const mockExportJson = vi.fn();
const mockExportNodeset2 = vi.fn();

vi.mock('../../services/tagImportExportService', () => ({
  tagImportExportService: {
    exportTagsCsv: (...args: unknown[]) => mockExportCsv(...args),
    exportTagsJson: (...args: unknown[]) => mockExportJson(...args),
    exportTagsNodeset2: (...args: unknown[]) => mockExportNodeset2(...args),
  },
}));

// ============================================================================
// Tests
// ============================================================================

describe('useTagImportExportDialogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Import Dialog
  // --------------------------------------------------------------------------

  describe('openImportDialog', () => {
    it('opens CSV file dialog with correct filter', async () => {
      mockOpen.mockResolvedValue('/path/to/tags.csv');
      mockReadTextFile.mockResolvedValue('tagId,deviceAddress\nmotor1,DataWord:0');

      const { result } = renderHook(() => useTagImportExportDialogs());

      let importResult: { content: string; format: string } | null = null;
      await act(async () => {
        importResult = await result.current.openImportDialog('csv');
      });

      expect(mockOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          multiple: false,
          filters: [{ name: 'CSV 파일', extensions: ['csv'] }],
          title: '태그 가져오기 (CSV)',
        }),
      );
      expect(mockReadTextFile).toHaveBeenCalledWith('/path/to/tags.csv');
      expect(importResult).toEqual({
        content: 'tagId,deviceAddress\nmotor1,DataWord:0',
        format: 'csv',
      });
    });

    it('opens JSON file dialog with correct filter', async () => {
      mockOpen.mockResolvedValue('/path/to/tags.json');
      mockReadTextFile.mockResolvedValue('{"Plant": {}}');

      const { result } = renderHook(() => useTagImportExportDialogs());

      let importResult: { content: string; format: string } | null = null;
      await act(async () => {
        importResult = await result.current.openImportDialog('json');
      });

      expect(mockOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [{ name: 'JSON 파일', extensions: ['json'] }],
          title: '태그 가져오기 (JSON)',
        }),
      );
      expect(importResult).toEqual({
        content: '{"Plant": {}}',
        format: 'json',
      });
    });

    it('returns null when user cancels the dialog', async () => {
      mockOpen.mockResolvedValue(null);

      const { result } = renderHook(() => useTagImportExportDialogs());

      let importResult: unknown = 'not-null';
      await act(async () => {
        importResult = await result.current.openImportDialog('csv');
      });

      expect(importResult).toBeNull();
      expect(mockReadTextFile).not.toHaveBeenCalled();
    });

    it('sets error on file read failure', async () => {
      mockOpen.mockResolvedValue('/path/to/file.csv');
      mockReadTextFile.mockRejectedValue(new Error('Permission denied'));

      const { result } = renderHook(() => useTagImportExportDialogs());

      await act(async () => {
        await result.current.openImportDialog('csv');
      });

      expect(result.current.error).toBe('Permission denied');
      expect(mockToastError).toHaveBeenCalledWith('파일 열기 실패', {
        description: 'Permission denied',
      });
    });

    it('tracks isDialogOpen state during operation', async () => {
      let resolveOpen: (value: string | null) => void;
      mockOpen.mockReturnValue(
        new Promise<string | null>((resolve) => {
          resolveOpen = resolve;
        }),
      );

      const { result } = renderHook(() => useTagImportExportDialogs());

      expect(result.current.isDialogOpen).toBe(false);

      let promise: Promise<unknown>;
      act(() => {
        promise = result.current.openImportDialog('csv');
      });

      expect(result.current.isDialogOpen).toBe(true);

      await act(async () => {
        resolveOpen!(null);
        await promise;
      });

      expect(result.current.isDialogOpen).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Export Dialog — CSV
  // --------------------------------------------------------------------------

  describe('exportWithSaveDialog — CSV', () => {
    it('uses correct file filter and extension for CSV', async () => {
      mockExportCsv.mockResolvedValue({
        content: 'tagId,deviceAddress\nmotor1,DataWord:0',
        tagCount: 1,
        format: 'csv',
      });
      mockSave.mockResolvedValue('/path/to/output.csv');
      mockWriteTextFile.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTagImportExportDialogs());

      let success = false;
      await act(async () => {
        success = await result.current.exportWithSaveDialog('csv');
      });

      expect(success).toBe(true);
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [{ name: 'CSV 파일', extensions: ['csv'] }],
          defaultPath: expect.stringMatching(/^tags_export_\d{8}_\d{4}\.csv$/),
          title: '태그 내보내기 (CSV)',
        }),
      );
      expect(mockWriteTextFile).toHaveBeenCalledWith(
        '/path/to/output.csv',
        'tagId,deviceAddress\nmotor1,DataWord:0',
      );
      expect(mockToastSuccess).toHaveBeenCalledWith('CSV 내보내기 완료', {
        description: '1개 태그를 저장했습니다.',
      });
    });
  });

  // --------------------------------------------------------------------------
  // Export Dialog — JSON
  // --------------------------------------------------------------------------

  describe('exportWithSaveDialog — JSON', () => {
    it('uses correct file filter and extension for JSON', async () => {
      mockExportJson.mockResolvedValue({
        content: '{"Plant":{}}',
        tagCount: 5,
        format: 'json',
      });
      mockSave.mockResolvedValue('/path/to/output.json');
      mockWriteTextFile.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTagImportExportDialogs());

      let success = false;
      await act(async () => {
        success = await result.current.exportWithSaveDialog('json');
      });

      expect(success).toBe(true);
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [{ name: 'JSON 파일', extensions: ['json'] }],
          defaultPath: expect.stringMatching(/^tags_export_\d{8}_\d{4}\.json$/),
          title: '태그 내보내기 (JSON)',
        }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith('JSON 내보내기 완료', {
        description: '5개 태그를 저장했습니다.',
      });
    });
  });

  // --------------------------------------------------------------------------
  // Export Dialog — NodeSet2 XML
  // --------------------------------------------------------------------------

  describe('exportWithSaveDialog — NodeSet2 XML', () => {
    it('uses correct file filter and extension for NodeSet2 XML', async () => {
      mockExportNodeset2.mockResolvedValue({
        content: '<?xml version="1.0"?><UANodeSet/>',
        tagCount: 3,
        format: 'nodeset2',
      });
      mockSave.mockResolvedValue('/path/to/output.xml');
      mockWriteTextFile.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTagImportExportDialogs());

      let success = false;
      await act(async () => {
        success = await result.current.exportWithSaveDialog('nodeset2');
      });

      expect(success).toBe(true);
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [{ name: 'OPC UA NodeSet2 XML', extensions: ['xml'] }],
          defaultPath: expect.stringMatching(/^tags_nodeset2_\d{8}_\d{4}\.xml$/),
          title: '태그 내보내기 (NodeSet2 XML)',
        }),
      );
      expect(mockWriteTextFile).toHaveBeenCalledWith(
        '/path/to/output.xml',
        '<?xml version="1.0"?><UANodeSet/>',
      );
      expect(mockToastSuccess).toHaveBeenCalledWith('NodeSet2 XML 내보내기 완료', {
        description: '3개 태그를 저장했습니다.',
      });
    });
  });

  // --------------------------------------------------------------------------
  // Export — Edge Cases
  // --------------------------------------------------------------------------

  describe('exportWithSaveDialog — edge cases', () => {
    it('returns false when user cancels save dialog', async () => {
      mockExportCsv.mockResolvedValue({
        content: 'data',
        tagCount: 1,
        format: 'csv',
      });
      mockSave.mockResolvedValue(null); // user cancelled

      const { result } = renderHook(() => useTagImportExportDialogs());

      let success = true;
      await act(async () => {
        success = await result.current.exportWithSaveDialog('csv');
      });

      expect(success).toBe(false);
      expect(mockWriteTextFile).not.toHaveBeenCalled();
    });

    it('shows warning when no tags to export', async () => {
      mockExportJson.mockResolvedValue({
        content: '{}',
        tagCount: 0,
        format: 'json',
      });

      const { result } = renderHook(() => useTagImportExportDialogs());

      let success = true;
      await act(async () => {
        success = await result.current.exportWithSaveDialog('json');
      });

      expect(success).toBe(false);
      expect(mockToastWarning).toHaveBeenCalledWith('내보낼 태그가 없습니다', {
        description: '태그 레지스트리가 비어 있습니다.',
      });
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('sets error on export failure', async () => {
      mockExportCsv.mockRejectedValue(new Error('Backend error'));

      const { result } = renderHook(() => useTagImportExportDialogs());

      await act(async () => {
        await result.current.exportWithSaveDialog('csv');
      });

      expect(result.current.error).toBe('Backend error');
    });

    it('sets error on file write failure', async () => {
      mockExportCsv.mockResolvedValue({
        content: 'data',
        tagCount: 1,
        format: 'csv',
      });
      mockSave.mockResolvedValue('/path/to/file.csv');
      mockWriteTextFile.mockRejectedValue(new Error('Disk full'));

      const { result } = renderHook(() => useTagImportExportDialogs());

      let success = true;
      await act(async () => {
        success = await result.current.exportWithSaveDialog('csv');
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Disk full');
    });

    it('passes ExportParams to backend', async () => {
      mockExportCsv.mockResolvedValue({
        content: 'data',
        tagCount: 2,
        format: 'csv',
      });
      mockSave.mockResolvedValue('/path/to/file.csv');
      mockWriteTextFile.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTagImportExportDialogs());

      await act(async () => {
        await result.current.exportWithSaveDialog('csv', {
          tagIds: ['tag1', 'tag2'],
          includeHeader: true,
        });
      });

      expect(mockExportCsv).toHaveBeenCalledWith({
        tagIds: ['tag1', 'tag2'],
        includeHeader: true,
      });
    });

    it('stores lastExportResult after successful export', async () => {
      const exportResult = {
        content: 'csv-data',
        tagCount: 4,
        format: 'csv' as const,
      };
      mockExportCsv.mockResolvedValue(exportResult);
      mockSave.mockResolvedValue('/path/to/file.csv');
      mockWriteTextFile.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTagImportExportDialogs());

      await act(async () => {
        await result.current.exportWithSaveDialog('csv');
      });

      expect(result.current.lastExportResult).toEqual(exportResult);
    });
  });

  // --------------------------------------------------------------------------
  // clearError
  // --------------------------------------------------------------------------

  describe('clearError', () => {
    it('clears the error state', async () => {
      mockOpen.mockResolvedValue('/path/to/file.csv');
      mockReadTextFile.mockRejectedValue(new Error('Some error'));

      const { result } = renderHook(() => useTagImportExportDialogs());

      await act(async () => {
        await result.current.openImportDialog('csv');
      });

      expect(result.current.error).toBe('Some error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Default filename generation
  // --------------------------------------------------------------------------

  describe('default filename format', () => {
    it('generates timestamp-based CSV filename', async () => {
      mockExportCsv.mockResolvedValue({
        content: 'data',
        tagCount: 1,
        format: 'csv',
      });
      mockSave.mockResolvedValue(null);

      const { result } = renderHook(() => useTagImportExportDialogs());

      await act(async () => {
        await result.current.exportWithSaveDialog('csv');
      });

      const callArgs = mockSave.mock.calls[0][0];
      // Format: tags_export_YYYYMMDD_HHMM.csv
      expect(callArgs.defaultPath).toMatch(/^tags_export_\d{8}_\d{4}\.csv$/);
    });

    it('generates timestamp-based NodeSet2 XML filename with distinct prefix', async () => {
      mockExportNodeset2.mockResolvedValue({
        content: '<xml/>',
        tagCount: 1,
        format: 'nodeset2',
      });
      mockSave.mockResolvedValue(null);

      const { result } = renderHook(() => useTagImportExportDialogs());

      await act(async () => {
        await result.current.exportWithSaveDialog('nodeset2');
      });

      const callArgs = mockSave.mock.calls[0][0];
      // Format: tags_nodeset2_YYYYMMDD_HHMM.xml
      expect(callArgs.defaultPath).toMatch(/^tags_nodeset2_\d{8}_\d{4}\.xml$/);
    });
  });
});
