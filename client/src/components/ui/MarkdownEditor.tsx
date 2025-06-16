import React from 'react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = "Enter content...",
  rows = 10,
  className = "w-full p-2 border rounded",
}) => {
  // In a real implementation, this would render a Markdown editor
  // (e.g., using react-markdown, react-mde, Tiptap, or a custom solution)
  // For now, it's just a styled textarea.
  return (
    <div className="bg-background p-1 border rounded-md shadow-sm">
      <div className="flex space-x-1 p-1 border-b mb-1">
        {/* Placeholder for toolbar buttons */}
        <button type="button" className="text-xs p-1 hover:bg-muted rounded" title="Bold">B</button>
        <button type="button" className="text-xs p-1 hover:bg-muted rounded" title="Italic">I</button>
        <button type="button" className="text-xs p-1 hover:bg-muted rounded" title="Link">Link</button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`${className} focus:ring-0 focus:outline-none resize-y min-h-[150px]`}
        aria-label="Markdown Content Editor"
      />
      <div className="text-xs text-muted-foreground p-1 border-t mt-1">
        Markdown is supported.
      </div>
    </div>
  );
};

export default MarkdownEditor;