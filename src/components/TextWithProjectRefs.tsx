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

// Parse text for formatting markers and return parts
// Order matters: parse longer markers first to avoid conflicts
function parseFormattedText(text: string): FormatPart[] {
  // Combined regex that matches all format types
  // Order: ** (bold), __ (underline), ~~ (strikethrough), * (italic)
  const formatRegex = /\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|\*([^*]+)\*/g;
  const parts: FormatPart[] = [];
  let lastIndex = 0;
  let match;

  while ((match = formatRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      parts.push({ type: 'bold', content: match[1] });
    } else if (match[2] !== undefined) {
      parts.push({ type: 'underline', content: match[2] });
    } else if (match[3] !== undefined) {
      parts.push({ type: 'strikethrough', content: match[3] });
    } else if (match[4] !== undefined) {
      parts.push({ type: 'italic', content: match[4] });
    }

    lastIndex = formatRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return parts;
}

// Render a format part with appropriate HTML element
function renderFormatPart(part: FormatPart, key: number): ReactNode {
  switch (part.type) {
    case 'bold':
      return <strong key={key}>{part.content}</strong>;
    case 'italic':
      return <em key={key}>{part.content}</em>;
    case 'underline':
      return <u key={key}>{part.content}</u>;
    case 'strikethrough':
      return <s key={key}>{part.content}</s>;
    default:
      return <span key={key}>{part.content}</span>;
  }
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
        // For text parts, also parse formatting markers
        const formatParts = parseFormattedText(part.content);
        if (formatParts.length === 1 && formatParts[0].type === 'text') {
          return <span key={index}>{part.content}</span>;
        }
        return (
          <span key={index}>
            {formatParts.map((fp, fpIndex) => renderFormatPart(fp, fpIndex))}
          </span>
        );
      })}
    </>
  );
}
