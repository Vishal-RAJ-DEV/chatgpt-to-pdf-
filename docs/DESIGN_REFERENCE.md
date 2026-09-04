# ChatGPT PDF Exporter - Visual Design Reference

## Overview

This document outlines the visual design, typography hierarchy, page layout rules, and component styling for documents exported by **ChatGPT PDF Exporter**. It serves as the visual reference specification for the document renderer module to ensure exported PDFs look clean, professional, readable, and structured.

---

## 1. Page Layout & Geometry

### 1.1 Page Sizes & Orientation
- **Supported Formats**:
  - **A4** (210mm × 297mm / 8.27in × 11.69in) - *Default*
  - **Letter** (215.9mm × 279.4mm / 8.5in × 11.0in)
- **Orientation**:
  - **Portrait** (Default)
  - **Landscape**

### 1.2 Margins
- **Standard Margin**: `18mm` (`~0.7in`) top/bottom/left/right.
- **Configurable Range**: `10mm` (Compact) to `25mm` (Wide).
- **Print Safety Area**: CSS `@page` margin setup ensures no content clipping near print printable boundaries.

---

## 2. Typography Hierarchy

### 2.1 Font Families
- **Body & Headings**: System sans-serif stack (`Inter`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `Roboto`, `Oxygen`, `Ubuntu`, `Cantarell`, `sans-serif`).
- **Code & Preformatted**: System monospace stack (`"JetBrains Mono"`, `"Fira Code"`, `"SFMono-Regular"`, `Consolas`, `"Liberation Mono"`, `Menlo`, `monospace`).

### 2.2 Typographic Scale

| Element | Font Size | Line Height | Weight | Margin / Spacing |
| :--- | :--- | :--- | :--- | :--- |
| **Document Title** | 22pt / 2.0em | 1.25 | 700 (Bold) | `0 0 8px 0` |
| **Document Subtitle / Metadata** | 9.5pt / 0.85em | 1.4 | 400 (Regular) | `0 0 20px 0` |
| **Heading 1 (H1)** | 16pt / 1.4em | 1.3 | 700 (Bold) | `18px 0 8px 0` |
| **Heading 2 (H2)** | 13.5pt / 1.2em | 1.35 | 600 (Semi-bold) | `14px 0 6px 0` |
| **Heading 3 (H3)** | 11.5pt / 1.05em | 1.4 | 600 (Semi-bold) | `10px 0 4px 0` |
| **Body Paragraph** | 10pt / 1.0em | 1.5 | 400 (Regular) | `0 0 10px 0` |
| **Code Block Text** | 9pt / 0.9em | 1.45 | 400 (Regular) | `0` |
| **Footer & Page Numbers** | 8.5pt / 0.8em | 1.2 | 400 (Regular) | `0` |

---

## 3. Document Structure & Header Layout

### 3.1 Document Header
- **Title Block**: Prominently displays conversation title at top of Page 1.
- **Metadata Sub-header**:
  - Exported Date & Time (e.g., `Exported on September 4, 2026 at 09:30 AM`)
  - Source URL link (e.g., `https://chatgpt.com/c/...`)
  - Subtle divider rule below sub-header (`1px solid #E5E7EB`).

### 3.2 Message Turn Layout
- **Author Badge / Role Header**:
  - **User Turn**: Visual badge or label ("User") with distinct color accent (`#2563EB` blue in light mode).
  - **Assistant Turn**: Visual badge or label ("ChatGPT") with distinct color accent (`#10B981` emerald green or `#4F46E5` indigo).
- **Separators**:
  - Soft horizontal divider between turns (`1px solid #E5E7EB` light mode / `#374151` dark mode).
  - Configurable spacing between messages (`16px` default).

---

## 4. Component Formatting

### 4.1 Paragraphs & Text
- Clean block paragraphs with consistent bottom margin.
- Automatic word wrapping and hyperlink styling (`color: #2563EB; text-decoration: underline`).

### 4.2 Lists (Ordered & Unordered)
- Indentation: `20px` padding-left.
- Bullet/Number style: Standard disk/decimal with `0.4em` item spacing.

### 4.3 Code Blocks & Snippets
- **Inline Code**: Muted grey background (`#F3F4F6`), subtle padding (`2px 5px`), border-radius (`4px`), monospace font.
- **Code Block**:
  - Dark or light code block background container (`#1E1E1E` or `#F8FAFC`).
  - Header bar indicating language (e.g., `python`, `typescript`).
  - Line wrapping: Enabled for print mode to prevent horizontal clipping.
  - Page Break Protection: `break-inside: avoid` to prevent code blocks from splitting across page boundaries when possible.

### 4.4 Blockquotes & Callouts
- Left border accent (`3px solid #3B82F6`).
- Background fill (`#F9FAFB`).
- Italicized body text with `12px` left padding.

### 4.5 Tables
- Full width or auto-fitting table borders (`1px solid #E5E7EB`).
- Alternating row zebra striping (`#F9FAFB` for even rows).
- Header row with bold text and dark background (`#F3F4F6`).

---

## 5. Header, Footer & Page Numbers

### 5.1 Running Footer
- Positioned in bottom printable margin.
- Left side: Document title (truncated if necessary).
- Right side: Dynamic Page Number (`Page X of Y` using CSS paged media counters `@page { @bottom-right { content: counter(page); } }`).

### 5.2 Page Break Rules
- `page-break-after: always` after document header optional section.
- `break-inside: avoid` on individual message cards or short code blocks.
- `widows: 2; orphans: 2` to prevent single trailing lines.

---

## 6. Color Schemes & Themes

### 6.1 Light Theme (Default for Print)
- Background: `#FFFFFF`
- Primary Text: `#111827`
- Secondary / Muted Text: `#6B7280`
- Borders: `#E5E7EB`
- Code Background: `#F8FAFC`

### 6.2 Dark Theme
- Background: `#111827`
- Primary Text: `#F9FAFB`
- Secondary / Muted Text: `#9CA3AF`
- Borders: `#374151`
- Code Background: `#1F2937`
