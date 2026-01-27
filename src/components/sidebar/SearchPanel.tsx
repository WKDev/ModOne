import { useState, useCallback, useEffect } from 'react';
import { Search, File } from 'lucide-react';

interface SearchResult {
  file: string;
  line: number;
  content: string;
  matchStart: number;
  matchEnd: number;
}

// Mock search results - will be replaced with actual search implementation
const mockSearch = (query: string): SearchResult[] => {
  if (!query || query.length < 2) return [];

  // Simulated results
  return [
    {
      file: 'config.yml',
      line: 5,
      content: `scan_time: 10  # ${query} related setting`,
      matchStart: 14,
      matchEnd: 14 + query.length,
    },
    {
      file: 'coils.csv',
      line: 12,
      content: `COIL_${query.toUpperCase()}_001,0,false`,
      matchStart: 5,
      matchEnd: 5 + query.length,
    },
  ];
};

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const performSearch = useCallback((searchQuery: string) => {
    setIsSearching(true);
    // Simulate async search
    setTimeout(() => {
      const searchResults = mockSearch(searchQuery);
      setResults(searchResults);
      setIsSearching(false);
    }, 200);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        performSearch(query);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleResultClick = (result: SearchResult) => {
    console.log('Open file at line:', result.file, result.line);
    // TODO: Implement file opening at specific line
  };

  // Group results by file
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.file]) {
      acc[result.file] = [];
    }
    acc[result.file].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div className="flex flex-col h-full">
      {/* Search Input */}
      <div className="p-2 border-b border-gray-700">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 pl-7 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {isSearching ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            Searching...
          </div>
        ) : query.length < 2 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            Enter at least 2 characters to search
          </div>
        ) : results.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No results found for "{query}"
          </div>
        ) : (
          <div className="py-2">
            {Object.entries(groupedResults).map(([file, fileResults]) => (
              <div key={file} className="mb-2">
                <div className="px-2 py-1 flex items-center gap-1 text-xs text-gray-400">
                  <File size={12} />
                  <span>{file}</span>
                  <span className="text-gray-600">({fileResults.length})</span>
                </div>
                {fileResults.map((result, index) => (
                  <button
                    key={index}
                    className="w-full px-4 py-1 text-left hover:bg-gray-700 text-sm"
                    onClick={() => handleResultClick(result)}
                  >
                    <span className="text-gray-500 mr-2">{result.line}:</span>
                    <span className="text-gray-300">
                      {result.content.slice(0, result.matchStart)}
                      <span className="bg-yellow-500/30 text-yellow-300">
                        {result.content.slice(result.matchStart, result.matchEnd)}
                      </span>
                      {result.content.slice(result.matchEnd)}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
