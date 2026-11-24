import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "u", "s", "h1", "h2", "h3", "blockquote", "ul", "ol", "li", "a", "pre", "code"];

export function sanitizeNoteHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "title", "target", "rel"],
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ["style"],
  }).replace(/<a\b(?![^>]*\brel=)[^>]*>/gi, (anchor) => anchor.replace(/>$/, ' rel="noopener noreferrer">'));
}

