import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface MarkdownTextProps {
  content: string;
  className?: string;
}

export function MarkdownText({ content, className }: MarkdownTextProps) {
  // Workaround: Manually replace **text** with <strong>text</strong>
  // This handles cases where ReactMarkdown doesn't parse ** correctly
  const processedContent = content.replace(/\*\*([^\*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');
  
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
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
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
