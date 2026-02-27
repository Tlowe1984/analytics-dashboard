import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface MarkdownTextProps {
  content: string;
  className?: string;
}

export function MarkdownText({ content, className }: MarkdownTextProps) {
  // Step 1: Escape HTML-like tags that aren't real HTML (e.g., <priya>, <insert>)
  // This prevents React from trying to render them as components
  let processedContent = content.replace(/<(?!\/?(strong|a|b|i|em|u|br|p|div|span|ul|ol|li|h[1-6])\b)([^>]+)>/gi, '&lt;$2&gt;');
  
  // Step 2: Manually replace **text** with <strong>text</strong>
  // This handles cases where ReactMarkdown doesn't parse ** correctly
  processedContent = processedContent.replace(/\*\*([^\*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');
  
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
          // Render list items with unique keys to avoid React warnings
          li: ({ children, ...props }) => {
            const key = typeof children === 'string' ? children.slice(0, 20) : Math.random().toString(36).slice(2);
            return <li key={key} className="my-0.5" {...props}>{children}</li>;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
