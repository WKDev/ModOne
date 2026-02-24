import { useProjectStore } from '../../stores/projectStore';


export function MacWindowBar() {
  const currentProject = useProjectStore((state) => state.currentProject);
  const isModified = useProjectStore((state) => state.isModified);
  
  const projectName = currentProject?.config.project.name;

  return (
    <div
      data-tauri-drag-region
      className="flex items-center h-8 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] select-none"
    >
      <div
        data-tauri-drag-region
        className="flex-1 flex items-center justify-center pl-[70px] pr-4"
      >
        <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
          ModOne{projectName ? ` - ${projectName}` : ''}{isModified ? ' *' : ''}
        </span>
      </div>
    </div>
  );
}
