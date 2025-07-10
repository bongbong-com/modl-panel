import ReactMarkdown from 'react-markdown';
import { cn } from 'modl-shared-web/lib/utils';
import { ClickablePlayer } from './clickable-player';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  allowHtml?: boolean;
}

// Function to process chat message lines and make usernames clickable
const processMarkdownContent = (content: string): string => {
  // Look for chat message pattern: `[timestamp]` **username**: message
  const chatMessagePattern = /(`\[.*?\]`\s+\*\*([^*]+)\*\*:\s+.*)/g;
  
  return content.replace(chatMessagePattern, (match, fullLine, username) => {
    // Replace the username with a special marker that we can process in the component
    return fullLine.replace(`**${username}**`, `**[PLAYER:${username}]**`);
  });
};

const MarkdownRenderer = ({ content, className, allowHtml = false }: MarkdownRendererProps) => {
  const processedContent = processMarkdownContent(content);
  
  return (
    <div className={cn(
      "prose prose-sm max-w-none",
      "prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground",
      "prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded",
      "prose-pre:bg-muted prose-pre:text-foreground prose-pre:border prose-pre:border-border",
      "prose-blockquote:text-muted-foreground prose-blockquote:border-l-border",
      "prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground",
      "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
      "prose-hr:border-border",
      className
    )}>
      <ReactMarkdown
        skipHtml={!allowHtml}
        components={{
          // Custom strong (bold) renderer to handle player links
          strong: ({ children, ...props }) => {
            const text = children?.toString() || '';
            const playerMatch = text.match(/^\[PLAYER:(.*)\]$/);
            
            if (playerMatch) {
              const username = playerMatch[1];
              return (
                <ClickablePlayer playerText={username} variant="text" showIcon={false}>
                  <strong className="text-primary cursor-pointer hover:underline">
                    {username}
                  </strong>
                </ClickablePlayer>
              );
            }
            
            return <strong {...props}>{children}</strong>;
          },
          // Custom link renderer to handle media URLs and external links
          a: ({ href, children, ...props }) => {
            // Check if this is a media URL that should be embedded
            const isMediaUrl = href && (
              href.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i) ||
              href.match(/\.(mp4|webm|mov)(\?.*)?$/i)
            );
            
            if (isMediaUrl) {
              const isImage = href.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i);
              const isVideo = href.match(/\.(mp4|webm|mov)(\?.*)?$/i);
              
              if (isImage) {
                return (
                  <div className="my-4">
                    <img 
                      src={href} 
                      alt={children?.toString() || "Media"}
                      className="max-w-full h-auto rounded border"
                      style={{ maxWidth: '500px' }}
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        View full size
                      </a>
                    </div>
                  </div>
                );
              } else if (isVideo) {
                return (
                  <div className="my-4">
                    <video 
                      src={href} 
                      controls 
                      className="max-w-full h-auto rounded border"
                      style={{ maxWidth: '500px' }}
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Open in new tab
                      </a>
                    </div>
                  </div>
                );
              }
            }
            
            // Default link behavior for non-media URLs
            return (
              <a 
                href={href} 
                target={href?.startsWith('http') ? '_blank' : undefined}
                rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                {...props}
              >
                {children}
              </a>
            );
          },
          // Custom code block renderer
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            
            if (isInline) {
              return (
                <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono" {...props}>
                  {children}
                </code>
              );
            }
            
            return (
              <pre className="bg-muted p-3 rounded border overflow-auto">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          // Custom blockquote renderer
          blockquote: ({ children, ...props }) => (
            <blockquote 
              className="border-l-4 border-border pl-4 py-2 bg-muted/30 rounded-r"
              {...props}
            >
              {children}
            </blockquote>
          ),
          // Ensure lists have proper spacing
          ul: ({ children, ...props }) => (
            <ul className="list-disc list-inside space-y-1" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="list-decimal list-inside space-y-1" {...props}>
              {children}
            </ol>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;