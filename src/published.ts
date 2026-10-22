// "Published mode" detection.
//
// A published HTML copy (produced by File → Publish HTML) is the app's own
// inlined index.html with the process file embedded as an inert data island:
//
//   <script id="__PROCESS_DATA__" type="application/json">…</script>
//
// The presence of that element IS the flag — there is no build-time switch
// and no URL parameter. When it's present the app hydrates from it and runs
// locked to read-only Navigate (the edit UI is suppressed in Toolbar /
// AppRibbon). Read it once, synchronously, at module load so the flag is
// known before the first render.

const DATA_ELEMENT_ID = '__PROCESS_DATA__';

export const publishedRaw: string | null =
  typeof document !== 'undefined'
    ? (document.getElementById(DATA_ELEMENT_ID)?.textContent ?? null)
    : null;

export const isPublished = publishedRaw !== null;
