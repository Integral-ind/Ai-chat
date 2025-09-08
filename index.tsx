
import React from 'react';
import ReactDOM from 'react-dom/client';
import AppWrapper from './App'; // Changed to import AppWrapper

function mountApplication() {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    // For further debugging if the issue persists, this will log the state of the HTML.
    console.error("Fatal: Root element (#root) not found in the DOM at the time of mounting.");
    console.error("Current document.body.innerHTML:", document.body ? document.body.innerHTML : "document.body is null");
    throw new Error("Could not find root element to mount to");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <AppWrapper />
    </React.StrictMode>
  );
}

if (document.readyState === 'loading') {
  // The document is still loading, wait for DOMContentLoaded
  document.addEventListener('DOMContentLoaded', mountApplication);
} else {
  // The DOMContentLoaded event has already fired, mount directly
  mountApplication();
}