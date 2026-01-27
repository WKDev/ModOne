/**
 * ProjectHeader Component
 *
 * Displays the current project name with a modified indicator (*)
 * when there are unsaved changes.
 */

import { useMemo } from 'react';
import { FileText } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';

interface ProjectHeaderProps {
  onClick?: () => void;
  showIcon?: boolean;
  className?: string;
}

export function ProjectHeader({
  onClick,
  showIcon = true,
  className = '',
}: ProjectHeaderProps) {
  const { currentProject, currentProjectPath, isModified } = useProjectStore();

  const projectName = useMemo(() => {
    if (!currentProject) return null;
    return currentProject.config?.project?.name || '이름 없는 프로젝트';
  }, [currentProject]);

  const displayName = useMemo(() => {
    if (!projectName) return '프로젝트 없음';
    return isModified ? `${projectName} *` : projectName;
  }, [projectName, isModified]);

  const isClickable = Boolean(onClick);

  return (
    <div
      data-testid="project-header"
      onClick={onClick}
      title={currentProjectPath || undefined}
      className={`
        flex items-center gap-2
        ${isClickable ? 'cursor-pointer hover:opacity-80' : ''}
        ${className}
      `}
    >
      {showIcon && (
        <FileText
          size={16}
          className={currentProject ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)]'}
        />
      )}
      <span
        data-testid="project-name"
        className={`
          text-sm font-medium truncate max-w-[200px]
          ${currentProject ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}
          ${isModified ? 'italic' : ''}
        `}
      >
        {displayName}
      </span>
    </div>
  );
}

export default ProjectHeader;
