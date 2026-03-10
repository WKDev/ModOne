import { memo, useCallback } from 'react';
import { useProjectStore } from '../../../stores/projectStore';
import { Settings, Cpu, Share2, Palette } from 'lucide-react';
import { CanvasProperties } from './properties/CanvasProperties';

export const ProjectSettingsPanel = memo(function ProjectSettingsPanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const currentProjectPath = useProjectStore((s) => s.currentProjectPath);
  const updateConfig = useProjectStore((s) => s.updateConfig);

  const handleMetadataChange = useCallback((field: string, value: string) => {
    // Current updateConfig only supports partial config updates, 
    // metadata is in currentProject.data.project or config? 
    // Looking at types/project.ts, ProjectConfig has 'project' field for settings.
    updateConfig({
      project: {
        ...(currentProject?.config.project || { name: '', description: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
        [field]: value,
      },
    });
  }, [currentProject, updateConfig]);

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500">
        <Settings size={48} className="mb-4 opacity-20" />
        <p>No project open</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-neutral-900 text-neutral-200 p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8 border-b border-neutral-800 pb-6">
        <div className="p-3 bg-purple-600/20 rounded-xl text-purple-400">
          <Settings size={32} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Project Settings</h1>
          <p className="text-neutral-400 text-sm">Configure global project behavior and metadata</p>
        </div>
      </div>

      <div className="space-y-12">
        {/* General Settings */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-neutral-400">
            <Share2 size={18} />
            <h2 className="text-sm font-semibold uppercase tracking-wider">General Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-neutral-800/50 p-6 rounded-xl border border-neutral-800">
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-500 uppercase">Project Name</label>
              <input
                type="text"
                value={currentProject.config.project.name}
                onChange={(e) => handleMetadataChange('name', e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-500 uppercase">Description</label>
              <input
                type="text"
                value={currentProject.config.project.description}
                onChange={(e) => handleMetadataChange('description', e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all outline-none"
              />
            </div>
          </div>
        </section>

        {/* PLC Settings */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-neutral-400">
            <Cpu size={18} />
            <h2 className="text-sm font-semibold uppercase tracking-wider">PLC Configuration</h2>
          </div>
          
          <div className="bg-neutral-800/50 p-6 rounded-xl border border-neutral-800 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-500 uppercase">Manufacturer</label>
                <select
                  value={currentProject.config.plc.manufacturer}
                  onChange={(e) => updateConfig({ plc: { ...currentProject.config.plc, manufacturer: e.target.value as any } })}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5 text-sm appearance-none outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="LS">LS Electric</option>
                  <option value="Mitsubishi">Mitsubishi</option>
                  <option value="Siemens">Siemens</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-500 uppercase">Model</label>
                <input
                  type="text"
                  value={currentProject.config.plc.model}
                  onChange={(e) => updateConfig({ plc: { ...currentProject.config.plc, model: e.target.value } })}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-500 uppercase">Scan Time (ms)</label>
                <input
                  type="number"
                  value={currentProject.config.plc.scan_time_ms}
                  onChange={(e) => updateConfig({ plc: { ...currentProject.config.plc, scan_time_ms: parseInt(e.target.value) } })}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Canvas Settings */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-neutral-400">
            <Palette size={18} />
            <h2 className="text-sm font-semibold uppercase tracking-wider">Canvas & Grid Preferences</h2>
          </div>
          
          <div className="bg-neutral-800/50 rounded-xl border border-neutral-800 overflow-hidden">
            <div className="p-6 bg-neutral-800/30 border-b border-neutral-800/50">
              <p className="text-sm text-neutral-400">
                These settings apply to all electrical schematics and ladder logic diagrams within the project.
              </p>
            </div>
            <div className="p-2">
               {/* Embed the existing CanvasProperties but without documentId context to focus on project-wide only */}
               <div className="max-w-md">
                 <CanvasProperties documentId={null} />
               </div>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-12 pt-8 border-t border-neutral-800 flex justify-between items-center text-xs text-neutral-500">
        <p>Project Path: {currentProjectPath || 'Unknown'}</p>
        <p>Last Updated: {new Date(currentProject.config.project.updated_at).toLocaleString()}</p>
      </div>
    </div>
  );
});

export default ProjectSettingsPanel;
