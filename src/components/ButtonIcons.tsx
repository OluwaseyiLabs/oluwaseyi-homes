// Icons that slide into a button on hover (buttons with the .icon-btn class). Each one does a small thing once it
// has arrived: the envelope opens, the house lights its window, the WhatsApp bubble gives a little ring.
// All the motion is in globals.css, so these need no JavaScript.

export function MailIcon() {
  return (
    <span className="btn-icon" aria-hidden>
      <svg viewBox="0 3 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect className="enq-letter" x="6.5" y="9.5" width="11" height="9" rx="1" />
        <path className="enq-body" d="M3 10.5h18v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5z" />
        <path d="M3.4 20.6 10 15.2M20.6 20.6 14 15.2" />
        <path className="enq-flap" d="M3 10.5 12 16.5l9-6" />
      </svg>
    </span>
  );
}

export function HouseIcon() {
  return (
    <span className="btn-icon" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11.2 12 4l9 7.2" />
        <path d="M5.5 9.5V20h13V9.5" />
        <path d="M10 20v-5.2h4V20" />
        <rect className="house-window" x="15" y="11" width="2.2" height="2.2" rx=".4" />
      </svg>
    </span>
  );
}

export function WhatsAppIcon() {
  return (
    <span className="btn-icon" aria-hidden>
      <svg className="wa-ring" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.89-9.88 9.89m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.48-8.41z" />
      </svg>
    </span>
  );
}
