import ReactMarkdown from 'react-markdown';

/** Markdown without HTML or images; links open outside and only http(s)/mail. */
export function SafeMarkdown({
  content,
}: {
  content: string | null | undefined;
}) {
  return (
    <ReactMarkdown
      urlTransform={(url) => (/^(https?:|mailto:)/i.test(url) ? url : '')}
      components={{
        img: () => null,
        a: ({ children, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
