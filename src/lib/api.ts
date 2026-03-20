// API Configuration
const PYTHON_API = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:5000';

/* =========================
   SHARED TYPES
========================= */

export type Role = 'admin' | 'executive' | 'member';

export interface UserProfile {
  id: string;
  email: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Simulation {
  id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config: any;
  results: any;
  created_at: string;
  updated_at: string;
}

export interface MapProject {
  id: number;
  name: string;
  description: string;
  grid_width: number;
  grid_height: number;
  cell_size: number;
  project_data: any;
  building_count: number;
  total_floors: number;
  created_at: string;
  updated_at: string;
}

export interface MapProjectSummary {
  id: number;
  name: string;
  description: string;
  grid_width: number;
  grid_height: number;
  cell_size: number;
  building_count: number;
  total_floors: number;
  created_at: string;
  updated_at: string;
}

/* =========================
   GENERIC REQUEST HELPER
========================= */

async function pythonRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${PYTHON_API}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // ✅ Always include cookies for session
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Unknown error',
    }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

/* =========================
AUTH SERVICE (Session-based) - WITH ERROR HANDLING
========================= */

export const authService = {
  // Login with session
  login: async (email: string, password: string) => {
    const response = await pythonRequest<{ success: boolean; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return response.user;
  },

  // Register new user
  signup: async (email: string, password: string, role: Role = 'member') => {
    const response = await pythonRequest<{ success: boolean; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    });
    return response.user;
  },

  // Logout (clears session) - with error handling
  logout: async () => {
    try {
      await pythonRequest('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      // Ignore errors on logout (session might already be expired)
      console.log('Logout error (ignored):', error);
    }
  },

  // Get current user from session
  getMe: async (): Promise<UserProfile | null> => {
    try {
      return await pythonRequest<UserProfile>('/api/auth/me', { method: 'GET' });
    } catch (error) {
      return null; // Not authenticated
    }
  },

  // Check if user is authenticated
  isAuthenticated: async (): Promise<boolean> => {
    const user = await authService.getMe();
    return user !== null;
  },
};

/* =========================
   PROFILE API
========================= */

export const profileAPI = {
  getMe: (): Promise<UserProfile> =>
    pythonRequest<UserProfile>('/api/auth/me', { method: 'GET' }),

  // You'll need to add these endpoints to Python later
  getAll: (): Promise<UserProfile[]> =>
    pythonRequest<UserProfile[]>('/api/users', { method: 'GET' }),

  updateRole: (userId: string, role: Role) =>
    pythonRequest<UserProfile>(`/api/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  delete: (userId: string): Promise<void> =>
    pythonRequest<void>(`/api/users/${userId}`, { method: 'DELETE' }),
};

/* =========================
   PROJECT API
========================= */

export const projectAPI = {
  getAll: (): Promise<MapProjectSummary[]> =>
    pythonRequest<MapProjectSummary[]>('/api/projects', { method: 'GET' }),

  getOne: (id: number): Promise<MapProject> =>
    pythonRequest<MapProject>(`/api/projects/${id}`, { method: 'GET' }),

  create: (data: {
    name: string;
    description?: string;
    grid_width: number;
    grid_height: number;
    cell_size: number;
    project_data: any;
    building_count: number;
    total_floors: number;
  }): Promise<{ id: number; success: boolean; message: string }> =>
    pythonRequest(`/api/projects`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (
    id: number,
    data: {
      name: string;
      description?: string;
      grid_width: number;
      grid_height: number;
      cell_size: number;
      project_data: any;
      building_count: number;
      total_floors: number;
    }
  ): Promise<{ id: number; success: boolean }> =>
    pythonRequest(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<{ success: boolean }> =>
    pythonRequest(`/api/projects/${id}`, { method: 'DELETE' }),

  validate: (
    id: number
  ): Promise<{
    valid: boolean;
    error?: string;
    building_count?: number;
    object_counts?: {
      walls: number;
      exits: number;
      stairs: number;
      npcs: number;
      lines: number;
    };
    message?: string;
  }> =>
    pythonRequest(`/api/projects/${id}/validate`, { method: 'GET' }),
};

/* =========================
   SIMULATION API
========================= */

export const simulationAPI = {
  getAll: (): Promise<any[]> =>
    pythonRequest('/api/simulations', { method: 'GET' }),

  getOne: (id: number): Promise<any> =>
    pythonRequest(`/api/simulations/${id}`, { method: 'GET' }),

  run: (params: {
    project_id?: number;
    project_data?: any;
    max_steps?: number;
    agents_per_npc?: number;
    disaster_type?: string;  
  }): Promise<any> =>
    pythonRequest('/api/simulations/run', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  delete: (id: number): Promise<void> =>
    pythonRequest(`/api/simulations/${id}`, { method: 'DELETE' }),
};

/* =========================
   ANNOUNCEMENT API
========================= */

export const announcementAPI = {
  getAll: (): Promise<any[]> =>
    pythonRequest('/api/announcements', { method: 'GET' }),

  create: (data: { title: string; content: string; image_url?: string; is_pinned?: boolean }) =>
    pythonRequest('/api/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  togglePin: (id: number, isPinned: boolean) =>
    pythonRequest(`/api/announcements/${id}/pin`, {
      method: 'PUT',
      body: JSON.stringify({ is_pinned: isPinned }),
    }),

  toggleLike: (id: number) =>
    pythonRequest(`/api/announcements/${id}/like`, { method: 'POST' }),

  delete: (id: number) =>
    pythonRequest(`/api/announcements/${id}`, { method: 'DELETE' }),

  getComments: (announcementId: number) =>
    pythonRequest(`/api/announcements/${announcementId}/comments`, { method: 'GET' }),

  addComment: (announcementId: number, content: string) =>
    pythonRequest(`/api/announcements/${announcementId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};

/* =========================
   EVENT API
========================= */

export const eventAPI = {
  getAll: (year?: number, month?: number): Promise<any[]> => {
    let url = '/api/events';
    if (year && month) {
      url += `?year=${year}&month=${month}`;
    }
    return pythonRequest(url, { method: 'GET' });
  },

  create: (data: {
    title: string;
    description?: string;
    event_type: 'training' | 'meeting' | 'drill' | 'other';
    start_time: string;
    end_time: string;
    location?: string;
    is_virtual?: boolean;
    meeting_link?: string;
    max_participants?: number;
  }) =>
    pythonRequest('/api/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

/* =========================
   LEGACY COMPATIBILITY
========================= */

// Keep for backward compatibility with existing code
export const authAPI = {
  login: authService.login,
  signup: authService.signup,
  logout: authService.logout,
};

export const pythonSimulationAPI = simulationAPI;

// Legacy simulation service (for components still using it)
export const simulationService = {
  runSimulation: (params: { buildings: any }) =>
    simulationAPI.run({ project_data: params.buildings }),

  getMap: () => {
    console.warn('getMap() is deprecated - use projectAPI instead');
    return Promise.resolve({ buildings: [] });
  },
};