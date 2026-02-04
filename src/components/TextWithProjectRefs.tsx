import type { ReactNode } from 'react';
import type { Project } from '../types';

interface TextWithProjectRefsProps {
  text: string;
  projects: Project[];
  onProjectClick?: (projectId: string) => void;
}

type PartType = 'text' | 'ref' | 'bold';

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

type FormatType = 'text' | 'bold' | 'italic' | 'underline' | 'strikethrough';

interface FormatPart {
  type: FormatType;
  content: string;
}

// Format patterns with their markers and types
const FORMAT_PATTERNS: Array<{ marker: string; type: FormatType; regex: RegExp }> = [
  { marker: '**', type: 'bold', regex: /\*\*(.+?)\*\*/g },
  { marker: '__', type: 'underline', regex: /__(.+?)__/g },
  { marker: '~~', type: 'strikethrough', regex: /~~(.+?)~~/g },
  { marker: '*', type: 'italic', regex: /\*(.+?)\*/g },
];

// Parse text for formatting markers and return parts (supports nesting)
function parseFormattedText(text: string): FormatPart[] {
  // Try each pattern in order (longer markers first to avoid conflicts)
  for (const { regex, type } of FORMAT_PATTERNS) {
    // Reset regex state
    regex.lastIndex = 0;
    const match = regex.exec(text);

    if (match) {
      const parts: FormatPart[] = [];
      const beforeMatch = text.slice(0, match.index);
      const afterMatch = text.slice(match.index + match[0].length);

      // Add text before the match
      if (beforeMatch) {
        parts.push(...parseFormattedText(beforeMatch));
      }

      // Add the formatted part (content may have nested formatting)
      parts.push({ type, content: match[1] });

      // Add text after the match
      if (afterMatch) {
        parts.push(...parseFormattedText(afterMatch));
      }

      return parts;
    }
  }

  // No formatting found, return as plain text
  return text ? [{ type: 'text', content: text }] : [];
}

// Recursively render formatted text with nesting support
function renderFormattedText(text: string, key: string | number = 0): ReactNode {
  const parts = parseFormattedText(text);

  if (parts.length === 0) return null;
  if (parts.length === 1 && parts[0].type === 'text') {
    return <span key={key}>{parts[0].content}</span>;
  }

  return (
    <span key={key}>
      {parts.map((part, index) => {
        const childKey = `${key}-${index}`;
        // Recursively render content for nested formatting
        const content = part.type === 'text'
          ? part.content
          : renderFormattedText(part.content, `${childKey}-inner`);

        switch (part.type) {
          case 'bold':
            return <strong key={childKey}>{content}</strong>;
          case 'italic':
            return <em key={childKey}>{content}</em>;
          case 'underline':
            return <u key={childKey}>{content}</u>;
          case 'strikethrough':
            return <s key={childKey}>{content}</s>;
          default:
            return <span key={childKey}>{part.content}</span>;
        }
      })}
    </span>
  );
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
