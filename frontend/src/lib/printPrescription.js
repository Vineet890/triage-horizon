/**
 * Safely and reliably prints an HTML prescription element in an isolated hidden iframe.
 * Completely eliminates blank pages caused by parent scroll containers or visibility:hidden styles.
 */
export function printPrescriptionElement(elementId = 'official-prescription-page') {
  const el = document.getElementById(elementId);
  if (!el) {
    window.print();
    return;
  }

  // Remove any stale printing iframe
  const existingFrame = document.getElementById('prescription-print-frame');
  if (existingFrame) existingFrame.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'prescription-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentWindow.document;
  frameDoc.open();

  // Extract all existing CSS link and style tags
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((s) => s.outerHTML)
    .join('\n');

  frameDoc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Official Prescription Slip - Triage Horizon</title>
        ${styles}
        <style>
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box;
          }
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          #official-prescription-page {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 10mm 12mm !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 8px !important;
            background: #ffffff !important;
            display: block !important;
            visibility: visible !important;
          }
          .no-print {
            display: none !important;
          }
        </style>
      </head>
      <body>
        ${el.outerHTML}
      </body>
    </html>
  `);
  frameDoc.close();

  // Give fonts, images, and tailwind rules a moment to parse
  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.warn('Iframe print failed, falling back to window.print', err);
      window.print();
    } finally {
      setTimeout(() => {
        iframe.remove();
      }, 4000);
    }
  }, 250);
}

