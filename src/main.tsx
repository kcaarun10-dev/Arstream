import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Permanently strip sandbox attributes from all iframes in the document
if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined') {
  const stripIframeSandbox = (el: Element) => {
    if (el.tagName === 'IFRAME' && el.hasAttribute('sandbox')) {
      el.removeAttribute('sandbox');
    }
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'sandbox') {
        const target = mutation.target as HTMLElement;
        if (target && target.tagName === 'IFRAME') {
          target.removeAttribute('sandbox');
        }
      } else if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            stripIframeSandbox(node);
            node.querySelectorAll('iframe[sandbox]').forEach((f) => f.removeAttribute('sandbox'));
          }
        });
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['sandbox'],
  });

  // Run initial cleanup on any existing frames
  document.querySelectorAll('iframe[sandbox]').forEach((f) => f.removeAttribute('sandbox'));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
