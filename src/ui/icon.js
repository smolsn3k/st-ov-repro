// The extension's symbol: an Alpha (A) set over an Omega (Ω). Drawn as inline SVG so it takes the surrounding text color
// (theme-friendly), and so it needs no icon font. Each instance carries its own mask id, which keeps it working inside
// hidden containers such as closed menus.
let n = 0;
export function aoIcon(cls = '') {
    const id = `ovr-ao-${++n}`;
    return `<svg class="ovr-ao ${cls}" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="#fff"/><path d="M50 3 L92 97 H8 Z" fill="#000" stroke="#000" stroke-width="13" stroke-linejoin="round"/></mask></defs><path mask="url(#${id})" d="M4 90 H30 C15 78 8 64 8 50 C8 29 26 13 50 13 C74 13 92 29 92 50 C92 64 85 78 70 90 H96" fill="none" stroke="currentColor" stroke-width="9.5"/><path fill="currentColor" fill-rule="evenodd" d="M50 3 L92 97 H78 L67.7 74 H32.3 L22 97 H8 Z M50 34.3 L61.9 61 H38.1 Z"/></svg>`;
}
