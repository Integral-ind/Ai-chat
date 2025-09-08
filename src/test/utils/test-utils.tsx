import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { vi } from 'vitest';

// Mock the context providers that might be used in tests
const MockStreamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div data-testid="mock-stream-provider">{children}</div>;
};

const MockErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div data-testid="mock-error-boundary">{children}</div>;
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
  withRouter?: boolean;
  withProviders?: boolean;
}

// Custom render function that includes common providers
const customRender = (
  ui: ReactElement,
  {
    initialEntries = ['/'],
    withRouter = true,
    withProviders = false,
    ...renderOptions
  }: CustomRenderOptions = {}
) => {
  const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    let element = children;

    if (withProviders) {
      element = (
        <MockStreamProvider>
          <MockErrorBoundary>
            {element}
          </MockErrorBoundary>
        </MockStreamProvider>
      );
    }

    if (withRouter) {
      element = (
        <HashRouter>
          {element}
        </HashRouter>
      );
    }

    return <>{element}</>;
  };

  return render(ui, { wrapper: AllTheProviders, ...renderOptions });
};

// Mock user object for tests
export const mockUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  avatar_url: 'https://example.com/avatar.jpg',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Mock project object for tests
export const mockProject = {
  id: 'test-project-id',
  name: 'Test Project',
  description: 'A test project',
  ownerId: 'test-user-id',
  ownerName: 'Test User',
  members: [mockUser],
  createdAt: '2024-01-01T00:00:00Z',
  progress: 50,
  totalTasks: 10,
  completedTasks: 5,
};

// Mock team object for tests
export const mockTeam = {
  id: 'test-team-id',
  name: 'Test Team',
  description: 'A test team',
  ownerId: 'test-user-id',
  members: [mockUser],
  createdAt: '2024-01-01T00:00:00Z',
};

// Common mock functions
export const mockFunctions = {
  onSubmit: vi.fn(),
  onClick: vi.fn(),
  onChange: vi.fn(),
  onClose: vi.fn(),
  onSave: vi.fn(),
  onDelete: vi.fn(),
  onEdit: vi.fn(),
  onCancel: vi.fn(),
};

// Mock Supabase client
export const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
  }),
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/file.jpg' } }),
    }),
  },
};

// Re-export everything from testing-library
export * from '@testing-library/react';
export { customRender as render };