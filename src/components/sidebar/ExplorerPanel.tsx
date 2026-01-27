import { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';

interface TreeNode {
  name: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
}

// Mock project structure - will be replaced with actual project data
const mockProjectTree: TreeNode[] = [
  {
    name: 'MyProject.mop',
    type: 'folder',
    children: [
      { name: 'config.yml', type: 'file' },
      {
        name: 'plc_csv',
        type: 'folder',
        children: [
          { name: 'coils.csv', type: 'file' },
          { name: 'discrete_inputs.csv', type: 'file' },
          { name: 'holding_registers.csv', type: 'file' },
          { name: 'input_registers.csv', type: 'file' },
        ],
      },
      {
        name: 'one_canvas',
        type: 'folder',
        children: [
          { name: 'canvas_1.json', type: 'file' },
        ],
      },
    ],
  },
];

interface TreeItemProps {
  node: TreeNode;
  level: number;
  onFileClick?: (filename: string) => void;
}

function TreeItem({ node, level, onFileClick }: TreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(level === 0);

  const handleClick = () => {
    if (node.type === 'folder') {
      setIsExpanded(!isExpanded);
    } else {
      onFileClick?.(node.name);
    }
  };

  const paddingLeft = level * 12 + 8;

  return (
    <div>
      <button
        className="w-full flex items-center gap-1 py-1 hover:bg-gray-700 text-gray-300 text-sm"
        style={{ paddingLeft }}
        onClick={handleClick}
      >
        {node.type === 'folder' ? (
          <>
            {isExpanded ? (
              <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
            ) : (
              <ChevronRight size={16} className="text-gray-500 flex-shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen size={16} className="text-yellow-500 flex-shrink-0" />
            ) : (
              <Folder size={16} className="text-yellow-500 flex-shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-4" />
            <File size={16} className="text-gray-400 flex-shrink-0" />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {node.type === 'folder' && isExpanded && node.children && (
        <div>
          {node.children.map((child, index) => (
            <TreeItem
              key={`${child.name}-${index}`}
              node={child}
              level={level + 1}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ExplorerPanel() {
  const handleFileClick = (filename: string) => {
    console.log('Open file:', filename);
    // TODO: Implement file opening logic
  };

  return (
    <div className="py-2">
      {mockProjectTree.length > 0 ? (
        mockProjectTree.map((node, index) => (
          <TreeItem
            key={`${node.name}-${index}`}
            node={node}
            level={0}
            onFileClick={handleFileClick}
          />
        ))
      ) : (
        <div className="px-4 py-8 text-center text-gray-500 text-sm">
          <p>No project open</p>
          <p className="mt-2 text-xs">
            Use File &gt; Open Project to get started
          </p>
        </div>
      )}
    </div>
  );
}
