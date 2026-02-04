import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownTextProps {
  content: string;
  className?: string;
}

export function MarkdownText({ content, className }: MarkdownTextProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Render bold text
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          // Render links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {children}
            </a>
          ),
          // Render paragraphs without extra spacing
          p: ({ children }) => <div className="inline">{children}</div>,
          // Render lists with proper spacing
          ul: ({ children }) => <ul className="list-disc list-inside my-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside my-2">{children}</ol>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
