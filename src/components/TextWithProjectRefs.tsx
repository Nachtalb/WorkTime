import type { Project } from '../types';

interface TextWithProjectRefsProps {
  text: string;
  projects: Project[];
  onProjectClick?: (projectId: string) => void;
}

type PartType = 'text' | 'ref' | 'vorgang' | 'elfall' | 'difovia';

interface Part {
  type: PartType;
  content: string;
  projectId?: string;
}

// Tag patterns:
// Vorgang: 14 numeric chars starting with "20"
// EL-Fall: 4 char alphabetic starting with "p" (case insensitive)
// Difovia: 5 char numeric starting with "0"
const TAG_PATTERNS = {
  vorgang: /\b(20\d{12})\b/g,
  elfall: /\b([pP][a-zA-Z]{3})\b/g,
  difovia: /\b(0\d{4})\b/g,
};

export function TextWithProjectRefs({ text, projects, onProjectClick }: TextWithProjectRefsProps) {
  // First pass: find all special patterns and project refs with their positions
  const matches: Array<{ start: number; end: number; type: PartType; content: string; projectId?: string }> = [];

  // Find project references
  const projectRegex = /#([^\s#]+)/g;
  let match;
  while ((match = projectRegex.exec(text)) !== null) {
    const projectName = match[1];
    const project = projects.find((p) => p.name.toLowerCase() === projectName.toLowerCase());
    if (project) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'ref',
        content: `#${project.name}`,
        projectId: project.id,
      });
    }
  }

  // Find Vorgang tags
  while ((match = TAG_PATTERNS.vorgang.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'vorgang',
      content: match[1],
    });
  }

  // Find EL-Fall tags
  while ((match = TAG_PATTERNS.elfall.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'elfall',
      content: match[1],
    });
  }

  // Find Difovia tags
  while ((match = TAG_PATTERNS.difovia.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'difovia',
      content: match[1],
    });
  }

  // Sort matches by start position and remove overlaps (earlier/longer matches win)
  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const filteredMatches: typeof matches = [];
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filteredMatches.push(m);
      lastEnd = m.end;
    }
  }

  // Build parts array
  const parts: Part[] = [];
  let lastIndex = 0;
  for (const m of filteredMatches) {
    if (m.start > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, m.start) });
    }
    parts.push({ type: m.type, content: m.content, projectId: m.projectId });
    lastIndex = m.end;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

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
        if (part.type === 'vorgang') {
          return (
            <span key={index} className="tag-vorgang" title="Vorgang">
              {part.content}
            </span>
          );
        }
        if (part.type === 'elfall') {
          return (
            <span key={index} className="tag-elfall" title="EL-Fall">
              {part.content}
            </span>
          );
        }
        if (part.type === 'difovia') {
          return (
            <span key={index} className="tag-difovia" title="Difovia">
              {part.content}
            </span>
          );
        }
        return <span key={index}>{part.content}</span>;
      })}
    </>
  );
}
