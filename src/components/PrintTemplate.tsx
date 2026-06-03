// PrintTemplate.tsx
// Reusable print template matching the PathSafe standard report format.
// Usage:
//   <PrintTemplate title="Report Title" preparedBy="Juan dela Cruz">
//     <p>Your content here</p>
//   </PrintTemplate>
//
// To trigger print:
//   printReport({ title, preparedBy, content: <JSX> })

import React from 'react';

interface PrintTemplateProps {
  title: string;
  preparedBy: string;
  date?: string; // defaults to today
  children: React.ReactNode;
}

const SYSTEM_TITLE = 'PATHSAFE: WEB-BASED DISASTER RISK REDUCTION AND MANAGEMENT\nSYSTEM WITH PATHFINDING AND ROUTE OPTIMIZATION USING A-STAR\nSEARCH ALGORITHM';

/** Inline component — renders directly in the page (hidden, for ref/print) */
export default function PrintTemplate({ title, preparedBy, date, children }: PrintTemplateProps) {
  const displayDate = date || new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="print-template" style={{
      fontFamily: 'Arial, sans-serif',
      fontSize: '12pt',
      color: '#000',
      background: '#fff',
      padding: '72px 80px',
      minHeight: '100vh',
      boxSizing: 'border-box',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '48px' }}>
        {/* Logo */}
        <img
          src="/Pathsafe2.png"
          alt="PathSafe Logo"
          style={{ width: '80px', height: '80px', objectFit: 'contain', flexShrink: 0 }}
        />
        {/* System title */}
        <div style={{
          fontSize: '11pt',
          fontWeight: 'bold',
          color: '#111',
          lineHeight: '1.5',
          textAlign: 'center',
          flex: 1,
        }}>
          {SYSTEM_TITLE.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </div>

      {/* ── Date (right-aligned) ─────────────────────────────────────────── */}
      <div style={{ textAlign: 'right', marginBottom: '32px', fontSize: '11pt' }}>
        {displayDate}
      </div>

      {/* ── Title (centered) ─────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13pt', marginBottom: '32px' }}>
        {title}
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '48px', lineHeight: '1.6', fontSize: '11pt' }}>
        {children}
      </div>

      {/* ── Prepared by (bottom left) ─────────────────────────────────────── */}
      <div style={{ fontSize: '11pt' }}>
        Prepared by: {preparedBy}
      </div>
    </div>
  );
}

/** ── printReport() — opens a new tab and prints ─────────────────────────────
 *  Pass a plain HTML string for content (use renderToStaticMarkup if needed).
 */
export function printReport({
  title,
  preparedBy,
  contentHtml,
  date,
}: {
  title: string;
  preparedBy: string;
  contentHtml: string;
  date?: string;
}) {
  const displayDate = date || new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // Resolve logo path — works on both localhost and Vercel
  const logoSrc = `${window.location.origin}/Pathsafe2.png`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>${title} — PathSafe</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            font-size: 12pt;
            color: #000;
            background: #fff;
          }
          .page {
            padding: 72px 80px;
            min-height: 100vh;
          }
          .header {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 48px;
          }
          .header img {
            width: 80px;
            height: 80px;
            object-fit: contain;
            flex-shrink: 0;
          }
          .header-title {
            font-size: 11pt;
            font-weight: bold;
            line-height: 1.5;
            text-align: center;
            flex: 1;
          }
          .date {
            text-align: right;
            font-size: 11pt;
            margin-bottom: 32px;
          }
          .report-title {
            text-align: center;
            font-weight: bold;
            font-size: 13pt;
            margin-bottom: 32px;
          }
          .content {
            font-size: 11pt;
            line-height: 1.6;
            margin-bottom: 48px;
          }
          .content table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
            font-size: 10pt;
          }
          .content table th,
          .content table td {
            border: 1px solid #ccc;
            padding: 6px 10px;
            text-align: left;
          }
          .content table th {
            background: #f0f0f0;
            font-weight: bold;
          }
          .prepared-by {
            font-size: 11pt;
          }
          .no-print { display: none !important; }
          @media print {
            .no-print { display: none !important; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <!-- Header -->
          <div class="header">
            <img src="${logoSrc}" alt="PathSafe Logo" />
            <div class="header-title">
              PATHSAFE: WEB-BASED DISASTER RISK REDUCTION AND MANAGEMENT<br/>
              SYSTEM WITH PATHFINDING AND ROUTE OPTIMIZATION USING A-STAR<br/>
              SEARCH ALGORITHM
            </div>
          </div>

          <!-- Date -->
          <div class="date">${displayDate}</div>

          <!-- Title -->
          <div class="report-title">${title}</div>

          <!-- Content -->
          <div class="content">${contentHtml}</div>

          <!-- Prepared by -->
          <div class="prepared-by">Prepared by: ${preparedBy}</div>
        </div>

        <!-- Print button (hidden on actual print) -->
        <div class="no-print" style="position:fixed;bottom:24px;right:24px;">
          <button onclick="window.print()" style="
            padding: 10px 24px;
            background: #166534;
            color: #fff;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          ">🖨️ Print / Save as PDF</button>
        </div>
      </body>
    </html>
  `;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}