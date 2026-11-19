import { ChevronDown, Download, Share } from 'lucide-react';

export default function ExportActions({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="report-actions">
      <div role="group" aria-label="Export" className="report-split">
        <button type="button" className="report-split__main" onClick={onOpen}>
          <Download size={20} aria-hidden="true" />
          Export CSV
        </button>
        <button
          type="button"
          className="report-split__more"
          aria-label="More export options: period and format"
          aria-haspopup="dialog"
          onClick={onOpen}
        >
          <ChevronDown size={24} aria-hidden="true" />
        </button>
      </div>
      <button type="button" className="report-share" aria-label="Export options" onClick={onOpen}>
        <Share size={22} aria-hidden="true" />
      </button>
    </div>
  );
}
