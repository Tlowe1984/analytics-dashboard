import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownTextProps {
  content: string;
  className?: string;
}

export function MarkdownText({ content, className }: MarkdownTextProps) {
  return (
    <span className={className}>
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
          // Render paragraphs inline (no extra spacing)
          p: ({ children }) => <span>{children}</span>,
        }}
      >
        {content}
      </ReactMarkdown>
    </span>
  );
}
