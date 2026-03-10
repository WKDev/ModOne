import { memo, useCallback } from 'react';
import { useProjectStore } from '../../../stores/projectStore';
import { CanvasProperties } from './properties/CanvasProperties';

export const ProjectSettingsPanel = memo(function ProjectSettingsPanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const currentProjectPath = useProjectStore((s) => s.currentProjectPath);
  const updateConfig = useProjectStore((s) => s.updateConfig);

  const handleMetadataChange = useCallback((field: string, value: string) => {
    updateConfig({
      project: {
        ...(currentProject?.config.project || { name: '', description: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
        [field]: value,
      },
    });
  }, [currentProject, updateConfig]);

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
        <p>No project open</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div className="max-w-2xl mx-auto p-6 space-y-8">

        {/* General Information */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            General Information
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Project Name</label>
              <input
                type="text"
                value={currentProject.config.project.name}
                onChange={(e) => handleMetadataChange('name', e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded outline-none focus:outline-none"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent-color)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
              />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Description</label>
              <input
                type="text"
                value={currentProject.config.project.description}
                onChange={(e) => handleMetadataChange('description', e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded outline-none"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent-color)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
              />
            </div>
          </div>
        </section>

        <div style={{ borderTop: '1px solid var(--border-color)' }} />

        {/* PLC Configuration */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            PLC Configuration
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Manufacturer</label>
              <select
                value={currentProject.config.plc.manufacturer}
                onChange={(e) => updateConfig({ plc: { ...currentProject.config.plc, manufacturer: e.target.value as any } })}
                className="w-full px-3 py-1.5 text-sm rounded outline-none appearance-none"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="LS">LS Electric</option>
                <option value="Mitsubishi">Mitsubishi</option>
                <option value="Siemens">Siemens</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Model</label>
              <input
                type="text"
                value={currentProject.config.plc.model}
                onChange={(e) => updateConfig({ plc: { ...currentProject.config.plc, model: e.target.value } })}
                className="w-full px-3 py-1.5 text-sm rounded outline-none"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent-color)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
              />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Scan Time (ms)</label>
              <input
                type="number"
                value={currentProject.config.plc.scan_time_ms}
                onChange={(e) => updateConfig({ plc: { ...currentProject.config.plc, scan_time_ms: parseInt(e.target.value) } })}
                className="w-full px-3 py-1.5 text-sm rounded outline-none"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent-color)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
              />
            </div>
          </div>
        </section>

        <div style={{ borderTop: '1px solid var(--border-color)' }} />

        {/* Canvas & Grid */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Canvas & Grid
          </h2>
          <CanvasProperties documentId={null} />
        </section>

        <div style={{ borderTop: '1px solid var(--border-color)' }} />

        {/* Footer info */}
        <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>{currentProjectPath || 'Unsaved project'}</span>
          <span>Updated {new Date(currentProject.config.project.updated_at).toLocaleString()}</span>
        </div>

      </div>
    </div>
  );
});

export default ProjectSettingsPanel;
