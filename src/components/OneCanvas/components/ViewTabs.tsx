/**
 * ViewTabs Component
 *
 * Bottom tabs for switching between 'Model' (schematic) and 'Layout' views.
 * Designed to feel like professional CAD/EDA software.
 */

import { memo } from 'react';
import { Box, Layout } from 'lucide-react';

export type ViewType = 'model' | 'layout';

interface ViewTabsProps {
    activeView: ViewType;
    onChangeView: (view: ViewType) => void;
}

export const ViewTabs = memo(function ViewTabs({
    activeView,
    onChangeView,
}: ViewTabsProps) {
    return (
        <div className="flex items-center h-full bg-neutral-900 border-t border-r border-neutral-700">
            <button
                type="button"
                onClick={() => onChangeView('model')}
                className={`h-full px-4 flex items-center gap-2 text-xs font-medium transition-colors border-r border-neutral-800 ${activeView === 'model'
                    ? 'bg-neutral-800 text-blue-400 shadow-[inset_0_-2px_0_0_#60a5fa]'
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
                    }`}
            >
                <Box size={14} />
                <span>Model</span>
            </button>
            <button
                type="button"
                onClick={() => onChangeView('layout')}
                className={`h-full px-4 flex items-center gap-2 text-xs font-medium transition-colors border-r border-neutral-800 ${activeView === 'layout'
                    ? 'bg-neutral-800 text-blue-400 shadow-[inset_0_-2px_0_0_#60a5fa]'
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
                    }`}
            >
                <Layout size={14} />
                <span>Layout</span>
            </button>
        </div>
    );
});

export default ViewTabs;
