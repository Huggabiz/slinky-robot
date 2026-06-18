import type React from 'react';
import './BookReadingGuide.css';

// Auto-generated reference section that sits between the intro
// chapters and the process chapters. Explains the terminology,
// activity types, date types, and provides a visual key to the
// flow chart symbols so readers unfamiliar with the tool can
// understand the book without guidance.
//
// Keep this in sync with the app's actual rendering — if new node
// badges, border styles, or concepts are added, update the
// descriptions here.
export function BookReadingGuide({
  chapterNumber,
  pageName,
}: {
  chapterNumber: number;
  pageName: string;
}) {
  return (
    <section
      className="book-chapter book-reading-guide"
      id="reading-guide"
      style={{ page: pageName } as React.CSSProperties}
    >
      <header className="book-chapter-header">
        <div className="book-chapter-heading">
          <div className="book-chapter-number">Chapter {chapterNumber}</div>
          <h2>How to Read This Document</h2>
        </div>
      </header>

      <div className="book-guide-body">
        <GuideSection title="Document Structure">
          <p>
            This document is organised into <strong>milestone phases</strong>,
            each representing a major stage of the process. Every phase contains:
          </p>
          <ul>
            <li>
              A <strong>deliverables summary</strong> listing what must be
              achieved to exit the phase.
            </li>
            <li>
              A <strong>task flow diagram</strong> showing the sequence and
              dependencies of process steps.
            </li>
            <li>
              <strong>Step cards</strong> with the detail of each process step
              — description, deliverables, accountable role, contributors,
              and prerequisite/dependent relationships.
            </li>
          </ul>
        </GuideSection>

        <GuideSection title="Terminology">
          <dl className="book-guide-terms">
            <dt>Milestone Phase</dt>
            <dd>
              A major stage or gate in the process. Work progresses through
              phases sequentially; each phase has exit criteria defined by
              its deliverable targets.
            </dd>
            <dt>Process Step</dt>
            <dd>
              An individual task or activity within a phase. Steps have
              an accountable role, optional contributors, and may produce
              or advance deliverables.
            </dd>
            <dt>Activity Type</dt>
            <dd>
              Classifies what kind of work a step involves — e.g.
              Activity, Review, Approval, Decision, or Meeting.
            </dd>
            <dt>Key Date / MS Date</dt>
            <dd>
              Steps flagged as time-critical milestones. Key Dates are
              hard deadlines; MS (Milestone) Dates are significant
              progress markers. These appear with an abbreviation code
              (e.g. CR1, VA MS).
            </dd>
            <dt>Deliverable</dt>
            <dd>
              A tangible output or artifact that progresses through
              defined states (e.g. Draft → Reviewed → Approved). The
              deliverables summary at the start of each phase shows the
              furthest state each item must reach to exit that phase.
            </dd>
            <dt>Accountable</dt>
            <dd>
              The single role responsible for ensuring a process step is
              completed. Every step has exactly one accountable role.
            </dd>
            <dt>Contributor</dt>
            <dd>
              Roles that participate in or support a process step but are
              not the primary owner.
            </dd>
            <dt>Meeting Organiser</dt>
            <dd>
              For steps that involve a meeting, the role responsible for
              scheduling and running it.
            </dd>
          </dl>
        </GuideSection>

        <GuideSection title="Reading the Flow Diagram">
          <p>
            Each phase includes a flow diagram showing how process steps
            connect. Read it top-to-bottom:
          </p>
          <table className="book-guide-key-table">
            <tbody>
              <KeyRow
                symbol={
                  <span className="book-guide-node-sample">
                    <span className="book-guide-node-id">10.001</span>
                    <span className="book-guide-node-name">Step Name</span>
                  </span>
                }
                description="A process step. The number is the step ID; the name summarises the activity."
              />
              <KeyRow
                symbol={<span className="book-guide-arrow">↓</span>}
                description="An arrow from one step to another means the source step must complete before the target can begin (a prerequisite dependency)."
              />
              <KeyRow
                symbol={<span className="book-guide-icon">📅</span>}
                description="Calendar icon — this step involves a meeting."
              />
              <KeyRow
                symbol={<span className="book-guide-icon">📄</span>}
                description="Document icon — this step has deliverable targets (it advances one or more deliverables to a defined state)."
              />
              <KeyRow
                symbol={
                  <span className="book-guide-separator">- - - - -</span>
                }
                description="A dashed horizontal line marks a key-date boundary. Steps below the line are gated by the key date above."
              />
              <KeyRow
                symbol={
                  <span className="book-guide-dots">
                    <span className="book-guide-dot" style={{ backgroundColor: '#ef4444' }} />
                    <span className="book-guide-dot" style={{ backgroundColor: '#3b82f6' }} />
                  </span>
                }
                description="Coloured dots at the bottom of a step show which departments contribute to it (in addition to the accountable department)."
              />
            </tbody>
          </table>
        </GuideSection>

        <GuideSection title="Colour Legend">
          <p>
            When the flow diagram uses departmental colouring, each step's
            border and fill indicate the department of its accountable
            role. The colour key beneath each diagram maps colours to
            department names.
          </p>
          <table className="book-guide-key-table">
            <tbody>
              <KeyRow
                symbol={
                  <span
                    className="book-guide-border-sample"
                    style={{ borderStyle: 'solid', backgroundColor: 'rgba(79,70,229,0.19)' }}
                  />
                }
                description="Solid border + tinted fill = accountable (primary owner)."
              />
              <KeyRow
                symbol={
                  <span
                    className="book-guide-border-sample"
                    style={{ borderStyle: 'dashed', backgroundColor: 'rgba(79,70,229,0.08)' }}
                  />
                }
                description="Dashed border + light fill = contributor."
              />
              <KeyRow
                symbol={
                  <span
                    className="book-guide-border-sample"
                    style={{ borderStyle: 'solid', backgroundColor: 'transparent' }}
                  />
                }
                description="Solid border, no fill = meeting organiser."
              />
              <KeyRow
                symbol={
                  <span
                    className="book-guide-border-sample"
                    style={{ borderStyle: 'dotted', backgroundColor: 'transparent' }}
                  />
                }
                description="Dotted border, no fill = referenced in description (mentioned via @Role but not structurally assigned)."
              />
            </tbody>
          </table>
        </GuideSection>

        <GuideSection title="Step Card Layout">
          <p>Each step card in the chapters that follow contains:</p>
          <ul>
            <li>
              <strong>Header</strong> — step ID, activity type badge,
              date-type badge (if applicable), and the step name.
            </li>
            <li>
              <strong>People</strong> — accountable role, contributors,
              and meeting organiser (if a meeting step).
            </li>
            <li>
              <strong>Description</strong> — what the step involves.
              Role names prefixed with <code>@</code> are formal role
              references that link back to the role registry.
            </li>
            <li>
              <strong>Deliverables</strong> — what comes out of the step.
            </li>
            <li>
              <strong>Deliverable targets</strong> — which deliverable
              items advance to which states at this step.
            </li>
            <li>
              <strong>Follows / Unlocks</strong> — prerequisite and
              dependent steps, showing how this step connects to the
              broader flow.
            </li>
          </ul>
        </GuideSection>
      </div>
    </section>
  );
}

function GuideSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="book-guide-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function KeyRow({
  symbol,
  description,
}: {
  symbol: React.ReactNode;
  description: string;
}) {
  return (
    <tr className="book-guide-key-row">
      <td className="book-guide-key-symbol">{symbol}</td>
      <td className="book-guide-key-desc">{description}</td>
    </tr>
  );
}
