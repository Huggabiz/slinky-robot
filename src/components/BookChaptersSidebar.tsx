import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getPhasesOrdered } from '../types';
import './BookChaptersSidebar.css';

export interface ChapterFilter {
  mode: 'include' | 'exclude';
  selectedIds: Set<string>;
}

export function isChapterFilterActive(f: ChapterFilter): boolean {
  return f.selectedIds.size > 0;
}

// Compute which chapter ids are visible given the filter.
export function isChapterVisible(id: string, f: ChapterFilter): boolean {
  if (f.selectedIds.size === 0) return true;
  return f.mode === 'include'
    ? f.selectedIds.has(id)
    : !f.selectedIds.has(id);
}

// Build the cover notice text.
export function chapterFilterNotice(
  f: ChapterFilter,
  labels: Map<string, string>,
): string {
  if (f.selectedIds.size === 0) return '';
  const names = [...f.selectedIds]
    .map((id) => labels.get(id) ?? id)
    .sort();
  const list = names.length <= 3
    ? names.join(', ')
    : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
  return f.mode === 'include'
    ? `This book has been configured to only include: ${list}.`
    : `This book has been configured to exclude: ${list}.`;
}

interface Props {
  filter: ChapterFilter;
  onChange: (next: ChapterFilter) => void;
}

interface Group {
  label: string;
  items: { id: string; label: string }[];
}

export function BookChaptersSidebar({ filter, onChange }: Props) {
  const file = useAppStore((s) => s.file);

  const groups = useMemo<Group[]>(() => {
    if (!file) return [];
    const out: Group[] = [];

    // Intro chapters group.
    const intros = [...file.introChapters].sort((a, b) => a.order - b.order);
    if (intros.length > 0) {
      out.push({
        label: 'Intro Chapters',
        items: intros.map((ch, i) => ({
          id: `intro-${ch.id}`,
          label: `${i + 1}. ${ch.title || '(untitled)'}`,
        })),
      });
    }

    // Reading guide.
    out.push({
      label: 'Reference',
      items: [{ id: 'guide', label: 'How to Read This Document' }],
    });

    // Phase chapters, grouped by sectionTitle.
    const phases = getPhasesOrdered(file);
    let currentGroup: Group | null = null;
    const introCount = intros.length;
    const guideNum = introCount + 1;

    for (let i = 0; i < phases.length; i++) {
      const p = phases[i];
      const chNum = guideNum + i + 1;
      if (p.sectionTitle || !currentGroup) {
        currentGroup = {
          label: p.sectionTitle || 'Process Phases',
          items: [],
        };
        out.push(currentGroup);
      }
      currentGroup.items.push({
        id: `phase-${p.id}`,
        label: `${chNum}. ${p.name}`,
      });
    }

    return out;
  }, [file]);

  // All item ids for select-all / clear-all.
  const allIds = useMemo(
    () => new Set(groups.flatMap((g) => g.items.map((it) => it.id))),
    [groups],
  );

  const toggle = (id: string) => {
    const next = new Set(filter.selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...filter, selectedIds: next });
  };

  const toggleGroup = (g: Group) => {
    const ids = g.items.map((it) => it.id);
    const allChecked = ids.every((id) => filter.selectedIds.has(id));
    const next = new Set(filter.selectedIds);
    if (allChecked) {
      for (const id of ids) next.delete(id);
    } else {
      for (const id of ids) next.add(id);
    }
    onChange({ ...filter, selectedIds: next });
  };

  return (
    <div className="book-chapters-sidebar">
      <div className="book-chapters-header">
        <h3>Chapters</h3>
      </div>

      <div className="book-chapters-mode">
        <label className={`book-chapters-mode-btn${filter.mode === 'include' ? ' active' : ''}`}>
          <input
            type="radio"
            name="chapterMode"
            checked={filter.mode === 'include'}
            onChange={() =>
              onChange({ ...filter, mode: 'include' })
            }
          />
          Include
        </label>
        <label className={`book-chapters-mode-btn${filter.mode === 'exclude' ? ' active' : ''}`}>
          <input
            type="radio"
            name="chapterMode"
            checked={filter.mode === 'exclude'}
            onChange={() =>
              onChange({ ...filter, mode: 'exclude' })
            }
          />
          Exclude
        </label>
      </div>

      <p className="book-chapters-hint">
        {filter.mode === 'include'
          ? 'Check chapters to include in the book.'
          : 'Check chapters to exclude from the book.'}
      </p>

      <div className="book-chapters-actions">
        <button
          type="button"
          className="book-perspectives-action"
          disabled={filter.selectedIds.size === allIds.size}
          onClick={() => onChange({ ...filter, selectedIds: new Set(allIds) })}
        >
          Select all
        </button>
        <button
          type="button"
          className="book-perspectives-action"
          disabled={filter.selectedIds.size === 0}
          onClick={() => onChange({ ...filter, selectedIds: new Set() })}
        >
          Clear
        </button>
      </div>

      {groups.map((g) => {
        const groupChecked = g.items.every((it) =>
          filter.selectedIds.has(it.id),
        );
        const groupPartial =
          !groupChecked &&
          g.items.some((it) => filter.selectedIds.has(it.id));
        return (
          <div key={g.label} className="book-chapters-group">
            <label className="book-chapters-group-label">
              <input
                type="checkbox"
                checked={groupChecked}
                ref={(el) => {
                  if (el) el.indeterminate = groupPartial;
                }}
                onChange={() => toggleGroup(g)}
              />
              {g.label}
            </label>
            <ul className="book-chapters-list">
              {g.items.map((it) => (
                <li key={it.id}>
                  <label className="book-chapters-item">
                    <input
                      type="checkbox"
                      checked={filter.selectedIds.has(it.id)}
                      onChange={() => toggle(it.id)}
                    />
                    {it.label}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
