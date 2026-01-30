import type { Project } from '../types';

interface TextWithProjectRefsProps {
  text: string;
  projects: Project[];
  onProjectClick?: (projectId: string) => void;
}

export function TextWithProjectRefs({ text, projects, onProjectClick }: TextWithProjectRefsProps) {
  // Parse text and find #ProjectName patterns
  const parts: Array<{ type: 'text' | 'ref'; content: string; projectId?: string }> = [];

  // Match #followed by non-whitespace characters
  const regex = /#([^\s#]+)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    const projectName = match[1];
    // Find project by exact name match (case-insensitive)
    const project = projects.find((p) => p.name.toLowerCase() === projectName.toLowerCase());

    if (project) {
      parts.push({ type: 'ref', content: `#${project.name}`, projectId: project.id });
    } else {
      // Not a valid project reference, treat as text
      parts.push({ type: 'text', content: match[0] });
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  // If no parts were found (no matches), just return the text
  if (parts.length === 0) {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'ref' && part.projectId) {
          return (
            <span
              key={index}
              className="project-ref"
              onClick={(e) => {
                e.stopPropagation();
                onProjectClick?.(part.projectId!);
              }}
              title={`Go to ${part.content.slice(1)}`}
            >
              {part.content}
            </span>
          );
        }
        return <span key={index}>{part.content}</span>;
      })}
    </>
  );
}
