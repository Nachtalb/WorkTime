import type { ReactNode } from 'react';
import type { Project } from '../types';

interface TextWithProjectRefsProps {
  text: string;
  projects: Project[];
  onProjectClick?: (projectId: string) => void;
}

type PartType = 'text' | 'ref';

interface Part {
  type: PartType;
  content: string;
  projectId?: string;
}

// Note type patterns (for whole-note matching):
// Vorgang: exactly 12 numeric chars starting with "20"
// EL-Fall: exactly 4 char alphabetic starting with "p" (case insensitive)
// Difovia: exactly 5 char numeric starting with "0"
// MF-Nummer: exactly 6 numeric chars
export type NoteTagType = 'vorgang' | 'elfall' | 'difovia' | 'mfnummer' | null;

export const NOTE_TAG_PATTERNS: Record<Exclude<NoteTagType, null>, { regex: RegExp; label: string }> = {
  vorgang: { regex: /^20\d{10}$/, label: 'Vorgang' },
  elfall: { regex: /^[pP][a-zA-Z]{3}$/, label: 'EL-Fall' },
  difovia: { regex: /^0\d{4}$/, label: 'Difovia' },
  mfnummer: { regex: /^\d{6}$/, label: 'MF-Nummer' },
};

export function detectNoteTagType(content: string): NoteTagType {
  const trimmed = content.trim();
  for (const [type, { regex }] of Object.entries(NOTE_TAG_PATTERNS)) {
    if (regex.test(trimmed)) {
      return type as NoteTagType;
    }
  }
  return null;
}

/**
 * Renders Markdown-style formatting to React elements.
 * Supports: `code`, ~~strike~~, **bold**, __underline__, *italic* or _italic_
 */
function renderFormattedText(text: string, key: string | number = 0): ReactNode {
  if (!text) return null;

  // Process formatting patterns in order (most specific first)
  // Each pattern: [regex, wrapper function]
  const patterns: Array<[RegExp, (content: ReactNode, k: string) => ReactNode]> = [
    [/`([^`]+)`/g, (c, k) => <code key={k} className="inline-code">{c}</code>],
    [/~~([^~]+)~~/g, (c, k) => <s key={k}>{c}</s>],
    [/\*\*([^*]+)\*\*/g, (c, k) => <strong key={k}>{c}</strong>],
    [/__([^_]+)__/g, (c, k) => <u key={k}>{c}</u>],
    [/(\*|_)([^*_]+)\1/g, (c, k) => <em key={k}>{c}</em>],
  ];

  // Try each pattern
  for (const [regex, wrapper] of patterns) {
    regex.lastIndex = 0;
    const match = regex.exec(text);

    if (match) {
      const parts: ReactNode[] = [];
      const beforeMatch = text.slice(0, match.index);
      const afterMatch = text.slice(match.index + match[0].length);
      // For italic pattern, capture group is at index 2, otherwise index 1
      const content = match[2] !== undefined ? match[2] : match[1];

      // Add text before the match (recursively process)
      if (beforeMatch) {
        parts.push(renderFormattedText(beforeMatch, `${key}-before`));
      }

      // Add the formatted part (recursively process content for nesting)
      const innerContent = renderFormattedText(content, `${key}-inner`);
      parts.push(wrapper(innerContent, `${key}-fmt`));

      // Add text after the match (recursively process)
      if (afterMatch) {
        parts.push(renderFormattedText(afterMatch, `${key}-after`));
      }

      return <span key={key}>{parts}</span>;
    }
  }

  // No formatting found, return as plain text
  return <span key={key}>{text}</span>;
}

export function TextWithProjectRefs({ text, projects, onProjectClick }: TextWithProjectRefsProps) {
  // Parse text and find #ProjectName patterns
  const parts: Part[] = [];

  const projectRegex = /#([^\s#]+)/g;
  let lastIndex = 0;
  let match;

  while ((match = projectRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    const projectName = match[1];
    const project = projects.find((p) => p.name.toLowerCase() === projectName.toLowerCase());

    if (project) {
      parts.push({ type: 'ref', content: `#${project.name}`, projectId: project.id });
    } else {
      parts.push({ type: 'text', content: match[0] });
    }

    lastIndex = projectRegex.lastIndex;
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
        // For text parts, render with formatting support (including nesting)
        return renderFormattedText(part.content, index);
      })}
    </>
  );
}
