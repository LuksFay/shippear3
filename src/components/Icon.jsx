const paths = {
  home: (
    <>
      <path d="M4 11 L12 4 L20 11" />
      <path d="M6 10 V20 H18 V10" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5 V19" />
      <path d="M5 12 H19" />
    </>
  ),
  ticket: (
    <>
      <rect x="3" y="5" width="18" height="14" />
      <path d="M3 12 H21" strokeDasharray="2 3" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 6 H20 V18 H4 Z" />
      <path d="M4 13 H20" />
    </>
  ),
  camera: (
    <>
      <rect x="3" y="7" width="18" height="13" />
      <path d="M8 7 L9.5 4.5 H14.5 L16 7" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M4 12 H19" />
      <path d="M13 6 L19 12 L13 18" />
    </>
  ),
  send: (
    <>
      <path d="M21 3 L10 14" />
      <path d="M21 3 L14 21 L10 14 L3 9 Z" />
    </>
  ),
  download: (
    <>
      <path d="M12 4 V15" />
      <path d="M7 11 L12 16 L17 11" />
      <path d="M4 20 H20" />
    </>
  ),
  check: <path d="M4 12 L10 18 L20 6" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3 V5 M12 19 V21 M3 12 H5 M19 12 H21" />
      <path d="M5.6 5.6 L7 7 M17 17 L18.4 18.4 M18.4 5.6 L17 7 M7 17 L5.6 18.4" />
    </>
  ),
  moon: <path d="M20 13.5 A8 8 0 1 1 10.5 4 A6.5 6.5 0 0 0 20 13.5 Z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20 C5 15.5 8 13.5 12 13.5 C16 13.5 19 15.5 19 20" />
    </>
  ),
  building: (
    <>
      <path d="M5 21 V5.5 L12 3 V21" />
      <path d="M12 7 H17 V21" />
      <path d="M8 10 H10 M8 14 H10 M14 10 H15 M14 14 H15" />
      <path d="M3 21 H21" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7 V12 L15.5 14" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 L22 20 H2 Z" />
      <path d="M12 10 V15" />
      <path d="M12 17.5 V18" />
    </>
  ),
  x: (
    <>
      <path d="M5 5 L19 19" />
      <path d="M19 5 L5 19" />
    </>
  ),
  doc: (
    <>
      <path d="M6 3 H15 L19 7 V21 H6 Z" />
      <path d="M15 3 V7 H19" />
      <path d="M9 12 H15 M9 16 H15" />
    </>
  ),
  mic: (
    <>
      <path d="M12 3 A4 4 0 0 0 8 7 V12 A4 4 0 0 0 12 16 A4 4 0 0 0 16 12 V7 A4 4 0 0 0 12 3 Z" />
      <path d="M5.5 12 A6.5 6.5 0 0 0 18.5 12" />
      <path d="M12 18 V21" />
    </>
  ),
  paperclip: (
    <path d="M20 12.5 L11.5 21 A5.5 5.5 0 0 1 3.7 13.2 L13.5 3.4 A3.8 3.8 0 0 1 18.9 8.8 L9.7 18 A2 2 0 0 1 6.9 15.2 L15.5 6.6" />
  ),
};

export default function Icon({ name, size = 20, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      {...rest}
    >
      {paths[name] || paths.doc}
    </svg>
  );
}
