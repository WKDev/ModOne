import { useState } from 'react';
import { Save, AlertCircle, Check } from 'lucide-react';
import type { SymbolDefinition } from '../../types/symbol';
import { saveSymbol } from '../../services/symbolService';
import { validateSymbol } from '../../utils/symbolValidation';

interface PropertiesPanelProps {
  symbol: SymbolDefinition;
  onChange: (symbol: SymbolDefinition) => void;
  projectDir: string;
  isDirty: boolean;
  onSaveSuccess?: () => void;
}

export function PropertiesPanel({
  symbol,
  onChange,
  projectDir,
  isDirty,
  onSaveSuccess,
}: PropertiesPanelProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChange = (field: keyof SymbolDefinition, value: string | number) => {
    onChange({
      ...symbol,
      [field]: value,
      updatedAt: new Date().toISOString(),
    });
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    setSaveMessage(null);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (!symbol.name.trim()) {
      newErrors.name = 'Name is required';
      isValid = false;
    }

    if (symbol.width < 20) {
      newErrors.width = 'Width must be at least 20';
      isValid = false;
    }

    if (symbol.height < 20) {
      newErrors.height = 'Height must be at least 20';
      isValid = false;
    }

    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(symbol.version)) {
      newErrors.version = 'Version must be in format X.Y.Z (e.g. 1.0.0)';
      isValid = false;
    }

    const validationResult = validateSymbol(symbol);
    if (!validationResult.valid) {
      validationResult.errors.forEach((err) => {
        if (err.rule === 'non_empty_name') {
          newErrors.name = err.message;
        } else if (err.rule === 'valid_dimensions') {
          if (!newErrors.width && !newErrors.height) {
             newErrors.width = err.message;
          }
        }
      });
      if (validationResult.errors.length > 0 && isValid) {
         const generalErrors = validationResult.errors.filter(
           e => e.rule !== 'non_empty_name' && e.rule !== 'valid_dimensions'
         );
         if (generalErrors.length > 0) {
           newErrors.general = generalErrors[0].message;
           isValid = false;
         }
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      await saveSymbol(projectDir, symbol, 'project');
      setSaveMessage({ type: 'success', text: 'Symbol saved successfully' });
      onSaveSuccess?.();
      
      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);
    } catch (err) {
      console.error('Failed to save symbol:', err);
      setSaveMessage({ 
        type: 'error', 
        text: err instanceof Error ? err.message : 'Failed to save symbol' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-[280px] flex flex-col bg-neutral-800 border-l border-neutral-700 h-full text-neutral-200">
      <div className="px-4 py-3 border-b border-neutral-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Properties</h3>
        {isDirty && <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved changes" />}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-1">
          <label htmlFor="symbol-name" className="block text-xs font-medium text-neutral-400">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            id="symbol-name"
            type="text"
            value={symbol.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className={`w-full px-2 py-1.5 bg-neutral-900 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              errors.name ? 'border-red-500' : 'border-neutral-700'
            }`}
            placeholder="Symbol Name"
          />
          {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="symbol-desc" className="block text-xs font-medium text-neutral-400">
            Description
          </label>
          <textarea
            id="symbol-desc"
            value={symbol.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            className="w-full px-2 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            placeholder="Optional description..."
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="symbol-category" className="block text-xs font-medium text-neutral-400">
            Category
          </label>
          <input
            id="symbol-category"
            type="text"
            value={symbol.category}
            onChange={(e) => handleChange('category', e.target.value)}
            className="w-full px-2 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="e.g. Power, Logic"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="symbol-width" className="block text-xs font-medium text-neutral-400">
              Width
            </label>
            <input
              id="symbol-width"
              type="number"
              min={20}
              step={20}
              value={symbol.width}
              onChange={(e) => handleChange('width', parseInt(e.target.value) || 0)}
              className={`w-full px-2 py-1.5 bg-neutral-900 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                errors.width ? 'border-red-500' : 'border-neutral-700'
              }`}
            />
            {errors.width && <p className="text-xs text-red-400">{errors.width}</p>}
          </div>
          <div className="space-y-1">
            <label htmlFor="symbol-height" className="block text-xs font-medium text-neutral-400">
              Height
            </label>
            <input
              id="symbol-height"
              type="number"
              min={20}
              step={20}
              value={symbol.height}
              onChange={(e) => handleChange('height', parseInt(e.target.value) || 0)}
              className={`w-full px-2 py-1.5 bg-neutral-900 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                errors.height ? 'border-red-500' : 'border-neutral-700'
              }`}
            />
            {errors.height && <p className="text-xs text-red-400">{errors.height}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="symbol-author" className="block text-xs font-medium text-neutral-400">
            Author
          </label>
          <input
            id="symbol-author"
            type="text"
            value={symbol.author || ''}
            onChange={(e) => handleChange('author', e.target.value)}
            className="w-full px-2 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Author Name"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="symbol-version" className="block text-xs font-medium text-neutral-400">
            Version
          </label>
          <input
            id="symbol-version"
            type="text"
            value={symbol.version}
            onChange={(e) => handleChange('version', e.target.value)}
            className={`w-full px-2 py-1.5 bg-neutral-900 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              errors.version ? 'border-red-500' : 'border-neutral-700'
            }`}
            placeholder="1.0.0"
          />
          {errors.version && <p className="text-xs text-red-400">{errors.version}</p>}
        </div>

        {errors.general && (
          <div className="p-2 bg-red-900/30 border border-red-800 rounded flex items-start gap-2">
            <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-300">{errors.general}</p>
          </div>
        )}

        {saveMessage && (
          <div className={`p-2 border rounded flex items-start gap-2 ${
            saveMessage.type === 'success' 
              ? 'bg-green-900/30 border-green-800 text-green-300' 
              : 'bg-red-900/30 border-red-800 text-red-300'
          }`}>
            {saveMessage.type === 'success' ? (
              <Check size={14} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
            )}
            <p className="text-xs">{saveMessage.text}</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-neutral-700 bg-neutral-800">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
            isSaving
              ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {isSaving ? (
            <>Saving...</>
          ) : (
            <>
              <Save size={16} />
              Save Symbol
            </>
          )}
        </button>
      </div>
    </div>
  );
}
