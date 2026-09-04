/**
 * Integration Smoke Test — Renderer HTML Document Correctness (Phase 10).
 *
 * Validates a representative multi-page, multi-block conversation through the pure renderer
 * in a Vitest JSDOM environment to guarantee production-readiness, visual rules preservation,
 * and zero text/UI leakage.
 */

import { describe, expect, it } from 'vitest';
import { Conversation } from '../../src/core/conversation/Model';
import { renderConversation } from '../../src/core/renderer/DocumentRenderer';
import { DEFAULT_RENDER_OPTIONS } from '../../src/core/renderer/RenderTypes';

describe('Renderer HTML Smoke Test (Vitest Simulation)', () => {
  const representativeConversation: Conversation = {
    id: 'smoke-conv-99',
    title: 'Full Technical Report & Math Reference',
    url: 'https://chatgpt.com/c/smoke-conv-99',
    createdAt: '2026-09-04T12:00:00Z',
    messages: [
      {
        id: 'turn-1',
        role: 'user',
        timestamp: '10:00 AM',
        blocks: [
          {
            type: 'paragraph',
            text: 'Please write a comprehensive technical summary on quantum mechanics and algorithms.',
            inlines: [
              { type: 'text', text: 'Please write a comprehensive technical summary on ' },
              { type: 'code', code: 'quantum mechanics' },
              { type: 'text', text: ' and algorithms.' },
            ],
          },
        ],
      },
      {
        id: 'turn-2',
        role: 'assistant',
        timestamp: '10:01 AM',
        blocks: [
          { type: 'heading', level: 1, text: 'Quantum Mechanics & Algorithm Design' },
          {
            type: 'paragraph',
            text: 'Quantum algorithms leverage superposition and entanglement to achieve exponential speedups.',
          },
          { type: 'heading', level: 2, text: 'Fundamental Equations' },
          { type: 'math', expression: 'i\\hbar \\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi', displayMode: true },
          { type: 'quote', text: 'God does not play dice with the universe. — Albert Einstein' },
          {
            type: 'heading',
            level: 3,
            text: 'Key Principles',
          },
          {
            type: 'list',
            ordered: true,
            items: [
              {
                text: 'Superposition',
                children: [{ text: 'Qubits exist in Linear combination of |0⟩ and |1⟩ states' }],
              },
              { text: 'Entanglement', children: [{ text: 'Non-local correlation between qubits' }] },
            ],
          },
          {
            type: 'code',
            language: 'python',
            code: 'def qft(circuit, n):\n    """Applies Quantum Fourier Transform on n qubits."""\n    for i in range(n):\n        circuit.h(i)\n        for j in range(i + 1, n):\n            circuit.cp(3.14159 / (2 ** (j - i)), j, i)',
          },
          {
            type: 'table',
            headers: ['Algorithm', 'Speedup', 'Primary Use Case'],
            rows: [
              ['Shor algorithm', 'Exponential', 'Integer Factorization'],
              ['Grover search', 'Quadratic', 'Unstructured Database Search'],
              ['HHL Algorithm', 'Exponential', 'Linear Systems Solver'],
            ],
          },
          {
            type: 'paragraph',
            text: 'For more details, visit Quantum Documentation or unsafe link.',
            inlines: [
              { type: 'text', text: 'For more details, visit ' },
              { type: 'link', href: 'https://example.org/quantum', text: 'Quantum Documentation' },
              { type: 'text', text: ' or ' },
              { type: 'link', href: 'javascript:alert(1)', text: 'unsafe link' },
            ],
          },
        ],
      },
    ],
  };

  it('1. renders complete standalone <!DOCTYPE html> document with correct metadata and title', () => {
    const html = renderConversation(representativeConversation, DEFAULT_RENDER_OPTIONS);

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<title>Full Technical Report &amp; Math Reference</title>');
    expect(html).toContain('Quantum Mechanics &amp; Algorithm Design');
  });

  it('2. includes Phase 8A tokens, CSS styling, and pagination @page rules', () => {
    const html = renderConversation(representativeConversation, DEFAULT_RENDER_OPTIONS);

    expect(html).toContain('@page');
    expect(html).toContain('margin:');
    expect(html).toContain('page-break-after: avoid;');
    expect(html).toContain('break-inside: avoid;');
    expect(html).toContain('.message-body');
  });

  it('3. renders all ContentBlock types cleanly without markup corruption', () => {
    const html = renderConversation(representativeConversation, DEFAULT_RENDER_OPTIONS);

    expect(html).toContain('<h1>Quantum Mechanics &amp; Algorithm Design</h1>');
    expect(html).toContain('<h2>Fundamental Equations</h2>');
    expect(html).toContain('<h3>Key Principles</h3>');
    expect(html).toContain('<div class="math-block math-display">i\\hbar \\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi</div>');
    expect(html).toContain('Superposition');
    expect(html).toContain('Qubits exist in Linear combination');
    expect(html).toContain('<code class="language-python">def qft(circuit, n):');
    expect(html).toContain('<th>Algorithm</th>');
    expect(html).toContain('<td>Shor algorithm</td>');
  });

  it('4. guarantees zero leakage of "undefined", "null", or raw diagnostic objects', () => {
    const html = renderConversation(representativeConversation, DEFAULT_RENDER_OPTIONS);

    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
    expect(html).not.toContain('[object Object]');
    expect(html).not.toContain('EXTRACTION_');
    expect(html).not.toContain('ADAPTER_');
  });

  it('5. guarantees zero leakage of ChatGPT control UI elements (Copy code, Edit, Regenerate)', () => {
    const html = renderConversation(representativeConversation, DEFAULT_RENDER_OPTIONS);

    expect(html).not.toContain('Copy code');
    expect(html).not.toContain('Regenerate response');
    expect(html).not.toContain('Edit message');
  });

  it('6. sanitizes dangerous links (javascript:) preventing script injection', () => {
    const html = renderConversation(representativeConversation, DEFAULT_RENDER_OPTIONS);

    expect(html).toContain('<a href="https://example.org/quantum">Quantum Documentation</a>');
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('unsafe link'); // Link text remains, dangerous href removed
  });
});
