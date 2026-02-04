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
        return <span key={index}>{part.content}</span>;
      })}
    </>
  );
}
