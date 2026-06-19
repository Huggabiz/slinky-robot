import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getPhasesOrdered, type ProcessFile } from '../types';
import './BookChaptersSidebar.css';

export interface ChapterFilter {
  mode: 'include' | 'exclude';
  selectedIds: Set<string>;
}

export interface ChapterGroup {
  label: string;
  items: { id: string; label: string }[];
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

// Shared grouping used by both the sidebar tree and the cover notice.
// Intro chapters, the reading guide, and phase chapters grouped by their
// section dividers.
export function computeChapterGroups(file: ProcessFile): ChapterGroup[] {
  const out: ChapterGroup[] = [];

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

  out.push({
    label: 'Reference',
    items: [{ id: 'guide', label: 'How to Read This Document' }],
  });

  const phases = getPhasesOrdered(file);
  let currentGroup: ChapterGroup | null = null;
  const guideNum = intros.length + 1;

  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    const chNum = guideNum + i + 1;
    if (p.sectionTitle || !currentGroup) {
      currentGroup = { label: p.sectionTitle || 'Process Phases', items: [] };
      out.push(currentGroup);
    }
    currentGroup.items.push({
      id: `phase-${p.id}`,
      label: `${chNum}. ${p.name}`,
    });
  }

  return out;
}

// Cover-page breakdown: lists the included/excluded chapters grouped the
// same way as the sidebar (mirrors the role FilterBreakdown style).
export function ChapterFilterBreakdown({
  filter,
  file,
}: {
  filter: ChapterFilter;
  file: ProcessFile;
}) {
  const groups = computeChapterGroups(file);
  const shown = groups
    .map((g) => ({
      label: g.label,
      items: g.items.filter((it) => filter.selectedIds.has(it.id)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <ul className="book-cover-filter-list">
      {shown.map((g) => (
        <li key={g.label}>
          <strong>{g.label}</strong>
          <ul className="book-cover-filter-roles">
            {g.items.map((it) => (
              <li key={it.id}>{it.label}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

interface Props {
  filter: ChapterFilter;
  onChange: (next: ChapterFilter) => void;
}

export function BookChaptersSidebar({ filter, onChange }: Props) {
  const file = useAppStore((s) => s.file);

  const groups = useMemo<ChapterGroup[]>(
    () => (file ? computeChapterGroups(file) : []),
    [file],
  );

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

  const toggleGroup = (g: ChapterGroup) => {
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
