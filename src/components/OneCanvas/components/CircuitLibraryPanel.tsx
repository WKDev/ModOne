/**
 * Circuit Library Panel Component
 *
 * UI for saving and loading reusable circuit templates.
 * Features:
 * - Save current selection as a template
 * - Browse saved templates by category
 * - Load templates onto canvas
 * - Delete templates
 */

import { memo, useState, useCallback, useMemo } from 'react';
import { Save, FolderOpen, Trash2, X, Search, Plus } from 'lucide-react';
import {
  loadLibrary,
  createTemplate,
  getTemplateById,
  prepareTemplateForInsertion,
  deleteTemplate,
  searchTemplates,
  type CircuitTemplate,
} from '../utils/circuitLibrary';
import type { Block, Wire, Junction, Position } from '../types';

// ============================================================================
// Types
// ============================================================================

interface CircuitLibraryPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Close the panel */
  onClose: () => void;
  /** Currently selected component IDs */
  selectedIds: Set<string>;
  /** All components */
  components: Map<string, Block>;
  /** All wires */
  wires: Wire[];
  /** All junctions */
  junctions: Map<string, Junction>;
  /** Callback when loading a template */
  onLoadTemplate: (
    components: Map<string, Block>,
    wires: Wire[],
    junctions: Map<string, Junction>,
    offset: Position
  ) => void;
}

// ============================================================================
// Component
// ============================================================================

export const CircuitLibraryPanel = memo(function CircuitLibraryPanel({
  isOpen,
  onClose,
  selectedIds,
  components,
  wires,
  junctions,
  onLoadTemplate,
}: CircuitLibraryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [saveCategory, setSaveCategory] = useState('Custom');
  const [saveTags, setSaveTags] = useState('');

  // Get library data
  const library = useMemo(() => loadLibrary(), []);
  
  // Filter templates
  const filteredTemplates = useMemo(() => {
    let templates = library.templates;
    
    if (searchQuery) {
      templates = searchTemplates(searchQuery);
    }
    
    if (selectedCategory) {
      templates = templates.filter(t => t.category === selectedCategory);
    }
    
    return templates;
  }, [library.templates, searchQuery, selectedCategory]);

  // Handle save template
  const handleSaveTemplate = useCallback(() => {
    if (!saveName.trim()) return;
    
    // Get selected components
    const selectedComponents = new Map<string, Block>();
    selectedIds.forEach(id => {
      const comp = components.get(id);
      if (comp) selectedComponents.set(id, comp);
    });
    
    if (selectedComponents.size === 0) {
      alert('Please select components to save as a template.');
      return;
    }
    
    // Get wires connected to selected components
    const selectedWires = wires.filter(wire => {
      const fromId = 'componentId' in wire.from ? wire.from.componentId : null;
      const toId = 'componentId' in wire.to ? wire.to.componentId : null;
      return (fromId && selectedIds.has(fromId)) || (toId && selectedIds.has(toId));
    });
    
    // Get junctions (if any selected)
    const selectedJunctions = new Map<string, Junction>();
    selectedIds.forEach(id => {
      const junction = junctions.get(id);
      if (junction) selectedJunctions.set(id, junction);
    });
    
    // Save template
    createTemplate(
      saveName.trim(),
      saveDescription.trim(),
      saveCategory,
      selectedComponents,
      selectedWires,
      selectedJunctions,
      saveTags.split(',').map((t: string) => t.trim()).filter((t: string) => t)
    );
    
    // Reset and close dialog
    setSaveName('');
    setSaveDescription('');
    setSaveCategory('Custom');
    setSaveTags('');
    setShowSaveDialog(false);
  }, [saveName, saveDescription, saveCategory, saveTags, selectedIds, components, wires, junctions]);

  // Handle load template
  const handleLoadTemplate = useCallback((template: CircuitTemplate) => {
    const templateData = getTemplateById(template.id);
    if (templateData) {
      // Calculate offset to place at center of viewport (simplified: use 100,100)
      const offset: Position = { x: 100, y: 100 };
      const prepared = prepareTemplateForInsertion(templateData, offset);
      
      // Convert arrays to Maps for onLoadTemplate
      const componentsMap = new Map<string, Block>();
      prepared.components.forEach(({ id, data }) => componentsMap.set(id, data));
      
      const junctionsMap = new Map<string, Junction>();
      prepared.junctions.forEach(({ id, data }) => junctionsMap.set(id, data));
      
      onLoadTemplate(componentsMap, prepared.wires, junctionsMap, offset);
      onClose();
    }
  }, [onLoadTemplate, onClose]);

  // Handle delete template
  const handleDeleteTemplate = useCallback((templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this template?')) {
      deleteTemplate(templateId);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[600px] max-h-[80vh] bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FolderOpen size={20} />
            Circuit Library
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-700">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-neutral-800 border border-neutral-600 rounded text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          
          {/* Category filter */}
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="px-3 py-1.5 bg-neutral-800 border border-neutral-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Categories</option>
            {library.metadata.categories.map((cat: string) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          
          {/* Save button */}
          <button
            onClick={() => setShowSaveDialog(true)}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-sm rounded transition-colors"
          >
            <Plus size={16} />
            Save Selection
          </button>
        </div>

        {/* Template list */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredTemplates.length === 0 ? (
            <div className="text-center text-neutral-500 py-8">
              {searchQuery || selectedCategory
                ? 'No templates match your search.'
                : 'No templates saved yet. Select components and click "Save Selection" to create a template.'}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredTemplates.map((template: CircuitTemplate) => (
                <div
                  key={template.id}
                  onClick={() => handleLoadTemplate(template)}
                  className="p-3 bg-neutral-800 border border-neutral-700 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-neutral-750 transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate">{template.name}</h3>
                      <p className="text-xs text-neutral-400 mt-0.5">{template.category}</p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteTemplate(template.id, e)}
                      className="p-1 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {template.description && (
                    <p className="text-xs text-neutral-500 mt-2 line-clamp-2">{template.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500">
                    <span>{template.components.length} components</span>
                    <span>•</span>
                    <span>{template.wires.length} wires</span>
                  </div>
                  {template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {template.tags.slice(0, 3).map((tag: string) => (
                        <span key={tag} className="px-1.5 py-0.5 bg-neutral-700 text-neutral-400 text-[10px] rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Dialog */}
        {showSaveDialog && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="w-[400px] bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Save size={18} />
                Save as Template
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Name *</label>
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Motor Start Circuit"
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Description</label>
                  <textarea
                    value={saveDescription}
                    onChange={(e) => setSaveDescription(e.target.value)}
                    placeholder="Standard DOL motor starter with overload protection"
                    rows={2}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Category</label>
                  <select
                    value={saveCategory}
                    onChange={(e) => setSaveCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white focus:outline-none focus:border-blue-500"
                  >
                    {library.metadata.categories.map((cat: string) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={saveTags}
                    onChange={(e) => setSaveTags(e.target.value)}
                    placeholder="motor, starter, DOL"
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={!saveName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded transition-colors"
                >
                  Save Template
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default CircuitLibraryPanel;
