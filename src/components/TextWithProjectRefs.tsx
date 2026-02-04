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
 * Renders Markdown-style formatting to HTML string.
 * Supports: `code`, ~~strike~~, **bold**, __underline__, *italic* or _italic_, [text](url)
 * Backslash escapes formatting characters.
 */
function renderMarkdown(text: string): string {
  if (!text) return '';
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Link: [text](url) - if [ not preceded by \
  html = html.replace(/(?<!\\)\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Logic: Match symbols only if not preceded by \
  html = html.replace(/(?<!\\)`([^`]+)(?<!\\)`/g, '<code class="inline-code">$1</code>');
  html = html.replace(/(?<!\\)~~([\s\S]+?)(?<!\\)~~/g, '<del>$1</del>');
  html = html.replace(/(?<!\\)\*\*([\s\S]+?)(?<!\\)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\\)__([\s\S]+?)(?<!\\)__/g, '<u>$1</u>');
  html = html.replace(/(?<!\\)([*_])(?!\1)([\s\S]+?)(?<!\\)\1/g, '<em>$2</em>');

  // Final pass: clean up the backslashes
  html = html.replace(/\\(.)/g, '$1');
  return html.replace(/\n/g, '<br>');
}

/**
 * React component that renders formatted text using dangerouslySetInnerHTML
 */
function FormattedText({ text, className }: { text: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />;
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
        return <FormattedText key={index} text={part.content} />;
      })}
    </>
  );
}
