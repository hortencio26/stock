@import "tailwindcss";

@theme {
  --font-sans: "Segoe UI", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-mono: "Segoe UI Mono", "JetBrains Mono", Consolas, Monaco, monospace;
}

body {
  font-family: var(--font-sans);
  background-color: #f3f4f6; /* bg-slate-100 style */
  color: #1e293b; /* text-slate-800 */
}

/* Custom scrollbars like WPF/Windows Forms modern apps */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: #f1f5f9;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Excel-like DataGrid specific styles */
.excel-grid {
  border-collapse: collapse;
  width: 100%;
}
.excel-grid th {
  background-color: #f1f5f9;
  border: 1px solid #cbd5e1;
  font-weight: 600;
  color: #334155;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.excel-grid td {
  border: 1px solid #e2e8f0;
  font-size: 0.875rem;
}
.excel-grid tr:nth-child(even) {
  background-color: #f8fafc;
}
.excel-grid tr:hover {
  background-color: #f1f5f9;
}

/* Print CSS Custom styling for reports and inventory sheets */
@media print {
  body {
    background-color: white !important;
    color: black !important;
    font-size: 10pt;
  }
  
  .print-hide,
  header,
  footer,
  aside,
  button,
  input,
  select,
  form,
  .inline-flex,
  .flex-wrap {
    display: none !important;
  }
  
  /* Make sure container is full width and un-shadowed during printing */
  main,
  .max-w-7xl {
    width: 100% !important;
    max-width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    box-shadow: none !important;
  }

  /* Don't restrict the size of scrollable divs on paper */
  .overflow-y-auto,
  .max-h-[450px],
  .max-h-[350px] {
    max-height: none !important;
    overflow: visible !important;
  }

  /* Force display of exact elements we want on PDF */
  .excel-grid {
    width: 100% !important;
    border-collapse: collapse !important;
    page-break-inside: auto;
  }
  
  .excel-grid tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }

  .excel-grid th, 
  .excel-grid td {
    padding: 6px 8px !important;
    border: 1px solid #94a3b8 !important; /* solid darker border for easy reading on paper */
    color: black !important;
    background: transparent !important;
  }

  .excel-grid tr:nth-child(even) {
    background-color: #f1f5f9 !important; /* solid gray on paper for row structure */
  }

  /* Highlight colors for printing */
  .bg-red-50 {
    background-color: #fef2f2 !important;
  }
  .bg-red-100 {
    background-color: #fee2e2 !important;
  }
  .bg-blue-50 {
    background-color: #eff6ff !important;
  }
  .bg-slate-200 {
    background-color: #e2e8f0 !important;
  }

  /* --- STRICT PRINT SIZE CONFIGURATIONS --- */
  @page {
    size: A4 landscape;
    margin: 15mm;
  }

  @page receipt-page {
    size: A5 portrait;
    margin: 10mm;
  }

  /* Force background colors and remove default page header/footers */
  html, body {
    background-color: #ffffff !important;
    color: #000000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* When the receipt modal is active, hide everything else dynamically using :has selector */
  body:has(.printable-receipt-container) {
    visibility: hidden !important;
    background-color: #ffffff !important;
  }

  body:has(.printable-receipt-container) .printable-receipt-container,
  body:has(.printable-receipt-container) .printable-receipt-container * {
    visibility: visible !important;
  }

  /* Ensure the container is absolute/full design flow in printing and uses the receipt-page size */
  .printable-receipt-container {
    page: receipt-page !important;
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    box-shadow: none !important;
    border: none !important;
  }

  /* Overrides for wrapper backgrounds & widths */
  .printable-receipt-wrapper {
    background: #ffffff !important;
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
  }

  .printable-receipt {
    background: #ffffff !important;
    margin: 0 auto !important;
    padding: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    
    /* Elegant zoom and scaling for optimal A5 viewport use, ensuring total legibility */
    zoom: 1.25 !important;
    -moz-transform: scale(1.25);
    -moz-transform-origin: top center;
  }

  /* Prevent split of essential details across margins */
  .printable-receipt > div {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  /* Fine adjustments to font sizes and crisp monospace font selection to nicely group elements and stabilize financial numbers within A5 */
  .printable-receipt .font-mono,
  .printable-receipt font-mono,
  .printable-receipt table,
  .printable-receipt .text-\[10px\],
  .printable-receipt .text-\[9px\],
  .printable-receipt td,
  .printable-receipt th {
    font-family: 'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace !important;
    font-size: 8.5pt !important;
    line-height: 1.3 !important;
    letter-spacing: -0.01em !important;
  }

  .printable-receipt h3 {
    font-size: 9.5pt !important;
    font-weight: 850 !important;
    line-height: 1.25 !important;
  }

  .printable-receipt h2 {
    font-size: 11.5pt !important;
    font-weight: 950 !important;
    line-height: 1.25 !important;
  }

  /* Centered, high-contrast and sharp Parish logo in A5 */
  .printable-receipt-logo {
    display: block !important;
    margin: 0 auto 8px auto !important;
    width: 55px !important;
    height: 55px !important;
    max-width: 55px !important;
    max-height: 55px !important;
    object-fit: contain !important;
    image-rendering: -webkit-optimize-contrast !important;
    image-rendering: crisp-edges !important;
  }

  /* Display all items tables fully without vertical scrolling/hidden lines */
  .printable-receipt .max-h-\[160px\],
  .printable-receipt .overflow-y-auto {
    max-height: none !important;
    overflow: visible !important;
    padding-right: 0 !important;
  }

  /* Sharp border dashes in physical printing */
  .printable-receipt .border-dashed {
    border-style: dashed !important;
    border-color: #000000 !important;
    border-width: 1px 0 0 0 !important;
    visibility: visible !important;
    opacity: 1 !important;
  }
}

/* --- PREMIUM BACKGROUND EXPORT & PRINT OVERRIDES FOR HTML2PDF AND WINDOW.PRINT --- */
body.printing-report {
  background-color: #ffffff !important;
  color: #000000 !important;
}

body.printing-report .print-hide {
  display: none !important;
}

body.printing-report .hidden.print\:flex {
  display: flex !important;
}

body.printing-report .bg-slate-50,
body.printing-report .bg-slate-100 {
  background-color: #f8fafc !important;
}

body.printing-report .bg-white {
  background-color: #ffffff !important;
}

body.printing-report .excel-grid th {
  background-color: #f1f5f9 !important;
  color: #1e293b !important;
  border-color: #94a3b8 !important;
}

body.printing-report .excel-grid td {
  border-color: #cbd5e1 !important;
}

body.printing-report #report-printable-area {
  padding: 10px !important;
  background-color: #ffffff !important;
  border: none !important;
  box-shadow: none !important;
}

