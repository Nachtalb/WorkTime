import type { Project, Note } from '../types';

/**
 * Simple fuzzy match - checks if all characters in the pattern appear in order in the target
 */
export function fuzzyMatch(target: string, pattern: string): boolean {
  if (!pattern) return true;
  if (!target) return false;

  const targetLower = target.toLowerCase();
  const patternLower = pattern.toLowerCase();

  // First try exact substring match (higher priority)
  if (targetLower.includes(patternLower)) {
    return true;
  }

  // Then try fuzzy match - all characters must appear in order
  let patternIdx = 0;
  for (let i = 0; i < targetLower.length && patternIdx < patternLower.length; i++) {
    if (targetLower[i] === patternLower[patternIdx]) {
      patternIdx++;
    }
  }

  return patternIdx === patternLower.length;
}

/**
 * Calculate a match score - lower is better
 * Returns -1 if no match
 */
function getMatchScore(target: string, pattern: string): number {
  if (!pattern) return 0;
  if (!target) return -1;

  const targetLower = target.toLowerCase();
  const patternLower = pattern.toLowerCase();

  // Exact match at start - best score
  if (targetLower.startsWith(patternLower)) {
    return 0;
  }

  // Exact substring match - good score
  const substringIndex = targetLower.indexOf(patternLower);
  if (substringIndex !== -1) {
    return 1 + substringIndex;
  }

  // Fuzzy match - calculate based on character gaps
  let patternIdx = 0;
  let gaps = 0;
  let lastMatchIdx = -1;

  for (let i = 0; i < targetLower.length && patternIdx < patternLower.length; i++) {
    if (targetLower[i] === patternLower[patternIdx]) {
      if (lastMatchIdx !== -1 && i - lastMatchIdx > 1) {
        gaps += i - lastMatchIdx - 1;
      }
      lastMatchIdx = i;
      patternIdx++;
    }
  }

  if (patternIdx === patternLower.length) {
    return 100 + gaps; // Fuzzy matches score higher (worse) than exact matches
  }

  return -1; // No match
}

export interface ProjectSearchResult {
  project: Project;
  score: number;
  matchedIn: ('name' | 'subtitle' | 'notes')[];
}

export interface SearchProjectsOptions {
  /** Exclude special projects (Other, ToDo) from results */
  excludeSpecial?: boolean;
  /** Current project ID to prioritize in sorting */
  currentProjectId?: string | null;
}

/**
 * Search projects by name, subtitle, and notes content using fuzzy matching
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

    // Check project name
    const nameScore = getMatchScore(project.name, searchText);
    if (nameScore !== -1) {
      matchedIn.push('name');
      bestScore = nameScore;
    }

    // Check subtitle
    if (project.subtitle) {
      const subtitleScore = getMatchScore(project.subtitle, searchText);
      if (subtitleScore !== -1) {
        matchedIn.push('subtitle');
        if (bestScore === -1 || subtitleScore < bestScore) {
          bestScore = subtitleScore + 10; // Slight penalty for subtitle match vs name match
        }
      }
    }

    // Check notes content
    const projectNotes = notes.filter((n) => n.projectId === project.id);
    for (const note of projectNotes) {
      const noteScore = getMatchScore(note.content, searchText);
      if (noteScore !== -1) {
        if (!matchedIn.includes('notes')) {
          matchedIn.push('notes');
        }
        if (bestScore === -1 || noteScore + 20 < bestScore) {
          bestScore = noteScore + 20; // Penalty for notes match vs name/subtitle match
        }
      }
    }

    if (matchedIn.length > 0) {
      results.push({ project, score: bestScore, matchedIn });
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
): Project[] {
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

  return sorted.map((r) => r.project);
}
