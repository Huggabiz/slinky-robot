import './PublishedBanner.css';

// Persistent banner shown at the top of a published HTML copy. Non-dismissible
// by design: the whole point is that a reader always knows this file can't be
// edited and the source of truth is the original .json.
export function PublishedBanner() {
  return (
    <div className="published-banner" role="status">
      <span className="published-banner-icon" aria-hidden="true">
        🔒
      </span>
      <span>
        This is a read-only published copy. To modify the process, keep and
        edit the original <code>.json</code> file.
      </span>
    </div>
  );
}
