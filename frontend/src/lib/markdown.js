import { marked } from 'marked'
import DOMPurify from 'dompurify'

// Configure marked options if needed (e.g. gfm, breaks)
marked.setOptions({
  gfm: true,
  breaks: true,
})

/**
 * Parses markdown text into sanitized HTML.
 * @param {string} text - Raw markdown text
 * @returns {string} Sanitized HTML string
 */
export function parseMarkdown(text) {
  if (!text) return ''
  try {
    const rawHtml = marked.parse(text)
    return DOMPurify.sanitize(rawHtml)
  } catch (err) {
    console.error('Failed to parse markdown:', err)
    // Never return unsanitized input — sanitize the raw text so a parse
    // failure can't become an XSS vector via dangerouslySetInnerHTML.
    return DOMPurify.sanitize(text)
  }
}
