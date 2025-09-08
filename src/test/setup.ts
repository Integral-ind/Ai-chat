import '@testing-library/jest-dom';
import { beforeAll, vi } from 'vitest';

// Mock environment variables for tests
beforeAll(() => {
  // Mock environment variables
  vi.stubEnv('REACT_APP_SUPABASE_URL', 'http://localhost:8000');
  vi.stubEnv('REACT_APP_SUPABASE_ANON_KEY', 'test-key');
  vi.stubEnv('REACT_APP_STREAM_API_KEY', 'test-stream-key');
  
  // Mock global objects that might not be available in test environment
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
  }));

  // Mock requestAnimationFrame
  global.requestAnimationFrame = vi.fn().mockImplementation(cb => {
    setTimeout(cb, 0);
    return 1;
  });

  // Mock cancelAnimationFrame
  global.cancelAnimationFrame = vi.fn();

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  });

  // Mock sessionStorage
  Object.defineProperty(window, 'sessionStorage', {
    value: localStorageMock
  });

  // Mock fetch
  global.fetch = vi.fn();

  // Mock Notification API
  Object.defineProperty(window, 'Notification', {
    value: vi.fn().mockImplementation(() => ({
      close: vi.fn(),
    })),
    writable: true,
  });

  // Mock URL.createObjectURL
  global.URL.createObjectURL = vi.fn();
  global.URL.revokeObjectURL = vi.fn();
});