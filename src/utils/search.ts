import type { Project, Note } from '../types';

/**
 * Fuzzy match within a single word - characters must appear in order
 * Returns the indices of matched characters, or null if no match
 */
function fuzzyMatchWord(target: string, pattern: string): number[] | null {
  if (!pattern) return [];
  if (!target) return null;

  const targetLower = target.toLowerCase();
  const patternLower = pattern.toLowerCase();

  const matchedIndices: number[] = [];
  let patternIdx = 0;

  for (let i = 0; i < targetLower.length && patternIdx < patternLower.length; i++) {
    if (targetLower[i] === patternLower[patternIdx]) {
      matchedIndices.push(i);
      patternIdx++;
    }
  }

  if (patternIdx === patternLower.length) {
    return matchedIndices;
  }

  return null;
}

/**
 * Word-based fuzzy match
 * - Each search word must fuzzy-match a target word
 * - Search words are matched in order against target words
 *
 * Examples:
 * - "Switzer Land" + "swi land" -> matches (swi->Switzer, land->Land)
 * - "Switzer Land" + "swiland" -> no match (swiland is one word, can't match two target words)
 * - "Switzerland" + "swiland" -> matches (fuzzy match within single word)
 * - "Switzerland" + "swi land" -> no match (two search words can't match one target word)
 */
export function fuzzyMatch(target: string, pattern: string): boolean {
  const result = fuzzyMatchWithIndices(target, pattern);
  return result !== null;
}

export interface FuzzyMatchResult {
  /** The original target string */
  target: string;
  /** Indices of matched characters in the target */
  matchedIndices: number[];
}

/**
 * Word-based fuzzy match that returns match indices for highlighting
 */
export function fuzzyMatchWithIndices(target: string, pattern: string): FuzzyMatchResult | null {
  if (!pattern.trim()) return { target, matchedIndices: [] };
  if (!target) return null;

  const targetWords = target.split(/\s+/);
  const patternWords = pattern.trim().split(/\s+/);

  // Quick check: if more pattern words than target words, no match possible
  if (patternWords.length > targetWords.length) {
    return null;
  }

  // Try to match each pattern word to a target word in order
  let targetWordIdx = 0;
  const allMatchedIndices: number[] = [];

  // Calculate offsets for each target word
  const wordOffsets: number[] = [];
  let offset = 0;
  for (let i = 0; i < targetWords.length; i++) {
    // Find actual position in original string (accounting for multiple spaces)
    const wordStart = target.indexOf(targetWords[i], offset);
    wordOffsets.push(wordStart);
    offset = wordStart + targetWords[i].length;
  }

  for (const patternWord of patternWords) {
    let matched = false;

    // Try to find a matching target word starting from current position
    while (targetWordIdx < targetWords.length) {
      const targetWord = targetWords[targetWordIdx];
      const wordOffset = wordOffsets[targetWordIdx];
      const matchIndices = fuzzyMatchWord(targetWord, patternWord);

      if (matchIndices !== null) {
        // Found a match - add indices with offset
        for (const idx of matchIndices) {
          allMatchedIndices.push(wordOffset + idx);
        }
        targetWordIdx++;
        matched = true;
        break;
      }

      targetWordIdx++;
    }

    if (!matched) {
      return null;
    }
  }

  return { target, matchedIndices: allMatchedIndices };
}

/**
 * Calculate a match score - lower is better
 * Returns -1 if no match
 */
function getMatchScore(target: string, pattern: string): { score: number; matchResult: FuzzyMatchResult | null } {
  if (!pattern.trim()) return { score: 0, matchResult: { target, matchedIndices: [] } };
  if (!target) return { score: -1, matchResult: null };

  const targetLower = target.toLowerCase();
  const patternLower = pattern.toLowerCase().trim();

  // Exact match at start - best score
  if (targetLower.startsWith(patternLower)) {
    const matchedIndices: number[] = [];
    for (let i = 0; i < patternLower.length; i++) {
      matchedIndices.push(i);
    }
    return { score: 0, matchResult: { target, matchedIndices } };
  }

  // Exact substring match - good score
  const substringIndex = targetLower.indexOf(patternLower);
  if (substringIndex !== -1) {
    const matchedIndices: number[] = [];
    for (let i = 0; i < patternLower.length; i++) {
      matchedIndices.push(substringIndex + i);
    }
    return { score: 1 + substringIndex, matchResult: { target, matchedIndices } };
  }

  // Word-based fuzzy match
  const fuzzyResult = fuzzyMatchWithIndices(target, pattern);
  if (fuzzyResult) {
    // Score based on how spread out the matches are
    const gaps = fuzzyResult.matchedIndices.length > 1
      ? fuzzyResult.matchedIndices[fuzzyResult.matchedIndices.length - 1] - fuzzyResult.matchedIndices[0] - fuzzyResult.matchedIndices.length + 1
      : 0;
    return { score: 100 + gaps, matchResult: fuzzyResult };
  }

  return { score: -1, matchResult: null };
}

export interface ProjectSearchResult {
  project: Project;
  score: number;
  matchedIn: ('name' | 'subtitle' | 'notes')[];
  /** Match details for highlighting */
  matchDetails?: {
    field: 'name' | 'subtitle' | 'notes';
    text: string;
    matchedIndices: number[];
  };
}

export interface SearchProjectsOptions {
  /** Exclude special projects (Other, ToDo) from results */
  excludeSpecial?: boolean;
  /** Current project ID to prioritize in sorting */
  currentProjectId?: string | null;
}

/**
 * Search projects by name, subtitle, and notes content using word-based fuzzy matching
 */
export function searchProjects(
  projects: Project[],
  notes: Note[],
  searchText: string,
  options: SearchProjectsOptions = {}
): ProjectSearchResult[] {
  const { excludeSpecial = false, currentProjectId } = options;

  if (!searchText.trim()) {
    // No search text - return all projects (optionally filtered)
    return projects
      .filter((p) => !excludeSpecial || (!p.isOther && !p.isTodo))
      .map((p) => ({ project: p, score: 0, matchedIn: [] as ('name' | 'subtitle' | 'notes')[] }));
  }

  const results: ProjectSearchResult[] = [];

  for (const project of projects) {
    // Skip special projects if requested
    if (excludeSpecial && (project.isOther || project.isTodo)) {
      continue;
    }

    const matchedIn: ('name' | 'subtitle' | 'notes')[] = [];
    let bestScore = -1;
    let matchDetails: ProjectSearchResult['matchDetails'] = undefined;

    // Check project name
    const nameResult = getMatchScore(project.name, searchText);
    if (nameResult.score !== -1) {
      matchedIn.push('name');
      bestScore = nameResult.score;
      if (nameResult.matchResult) {
        matchDetails = {
          field: 'name',
          text: project.name,
          matchedIndices: nameResult.matchResult.matchedIndices,
        };
      }
    }

    // Check subtitle
    if (project.subtitle) {
      const subtitleResult = getMatchScore(project.subtitle, searchText);
      if (subtitleResult.score !== -1) {
        matchedIn.push('subtitle');
        const adjustedScore = subtitleResult.score + 10; // Slight penalty for subtitle match
        if (bestScore === -1 || adjustedScore < bestScore) {
          bestScore = adjustedScore;
          if (subtitleResult.matchResult) {
            matchDetails = {
              field: 'subtitle',
              text: project.subtitle,
              matchedIndices: subtitleResult.matchResult.matchedIndices,
            };
          }
        }
      }
    }

    // Check notes content (excluding completed todos)
    const projectNotes = notes.filter((n) => n.projectId === project.id && !n.completed);
    for (const note of projectNotes) {
      const noteResult = getMatchScore(note.content, searchText);
      if (noteResult.score !== -1) {
        if (!matchedIn.includes('notes')) {
          matchedIn.push('notes');
        }
        const adjustedScore = noteResult.score + 20; // Penalty for notes match
        if (bestScore === -1 || adjustedScore < bestScore) {
          bestScore = adjustedScore;
          if (noteResult.matchResult) {
            matchDetails = {
              field: 'notes',
              text: note.content,
              matchedIndices: noteResult.matchResult.matchedIndices,
            };
          }
        }
      }
    }

    if (matchedIn.length > 0) {
      results.push({ project, score: bestScore, matchedIn, matchDetails });
    }
  }

  // Sort by score (lower is better)
  results.sort((a, b) => {
    // Current project always first if it matches
    if (currentProjectId) {
      if (a.project.id === currentProjectId) return -1;
      if (b.project.id === currentProjectId) return 1;
    }

    // Then by score
    return a.score - b.score;
  });

  return results;
}

/**
 * Filter projects for display, with sorting options
 */
export function filterAndSortProjects(
  searchResults: ProjectSearchResult[],
  options: {
    currentProjectId?: string | null;
    sortDoneLast?: boolean;
    sortOnHoldAfterActive?: boolean;
  } = {}
): ProjectSearchResult[] {
  const { currentProjectId, sortDoneLast = true, sortOnHoldAfterActive = true } = options;

  const sorted = [...searchResults];

  sorted.sort((a, b) => {
    // Current project first
    if (currentProjectId) {
      if (a.project.id === currentProjectId) return -1;
      if (b.project.id === currentProjectId) return 1;
    }

    // Done projects last
    if (sortDoneLast) {
      if (a.project.doneAt && !b.project.doneAt) return 1;
      if (!a.project.doneAt && b.project.doneAt) return -1;
    }

    // On hold projects after active
    if (sortOnHoldAfterActive) {
      if (a.project.onHoldAt && !b.project.onHoldAt) return 1;
      if (!a.project.onHoldAt && b.project.onHoldAt) return -1;
    }

    // Then by search score
    if (a.score !== b.score) {
      return a.score - b.score;
    }

    // Finally by last used
    return b.project.lastUsed - a.project.lastUsed;
  });

  return sorted;
}
