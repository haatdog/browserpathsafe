// API Configuration — env var kept as VITE_PYTHON_API_URL (unchanged)
const PYTHON_API = import.meta.env.VITE_PYTHON_API_URL ;

/* =========================
   SHARED TYPES
========================= */

export type Role = 'admin' | 'executive' | 'member';
export type DisasterType = 'fire' | 'earthquake' | 'bomb';

export interface UserProfile {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  role: Role;
  group_id?: number | null;
  group_name?: string | null;
  is_head?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Simulation {
  id: number;
  user_id?: string;
  project_id?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  disaster_type: DisasterType;
  config: any;
  results: any;
  steps: number;
  elapsed_s: number;
  evacuation_time: number;
  agents_spawned: number;
  agents_evacuated: number;
  agents_trapped: number;
  project_name?: string;
  project_data?: any;
  created_at: string;
  completed_at: string;
}

export interface SimulationJob {
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    pct: number;
    step: number;
    max_steps: number;
    evacuated: number;
    remaining: number;
    queued: number;
    total: number;
  };
  results: any | null;
  error: string | null;
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

// Token stored in localStorage for cross-domain auth (Vercel → Render)
const TOKEN_KEY = 'pathsafe_token';
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function pythonRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = tokenStore.get();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${PYTHON_API}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

/* =========================
   AUTH SERVICE — /api/auth/*
   src/routes/auth.py  (unchanged)
========================= */

export const authService = {
  login: async (email: string, password: string) => {
    const response = await pythonRequest<{ success: boolean; user: UserProfile; token?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (response.token) tokenStore.set(response.token);
    return response.user;
  },

  signup: async (email: string, password: string, role: Role = 'member') => {
    const response = await pythonRequest<{ success: boolean; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    });
    return response.user;
  },

  logout: async () => {
    try {
      await pythonRequest('/api/auth/logout', { method: 'POST' });
      tokenStore.clear();
    } catch (error) {
      console.log('Logout error (ignored):', error);
    }
  },

  getMe: async (): Promise<UserProfile | null> => {
    try {
      return await pythonRequest<UserProfile>('/api/auth/me', { method: 'GET' });
    } catch {
      return null;
    }
  },

  isAuthenticated: async (): Promise<boolean> => {
    const user = await authService.getMe();
    return user !== null;
  },
};

/* =========================
   PROFILE / USER API — /api/users/*
   src/routes/users.py

   ADDED: updateGroup()
========================= */

export const profileAPI = {
  getMe: (): Promise<UserProfile> =>
    pythonRequest<UserProfile>('/api/auth/me', { method: 'GET' }),

  getAll: (): Promise<UserProfile[]> =>
    pythonRequest<UserProfile[]>('/api/users', { method: 'GET' }),

  updateRole: (userId: string, role: Role) =>
    pythonRequest<UserProfile>(`/api/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  delete: (userId: string): Promise<void> =>
    pythonRequest<void>(`/api/users/${userId}`, { method: 'DELETE' }),

  // ✅ ADDED
  updateGroup: (userId: string, groupId: number | null, isHead = false) =>
    pythonRequest(`/api/users/${userId}/group`, {
      method: 'PUT',
      body: JSON.stringify({ group_id: groupId, is_head: isHead }),
    }),
};

/* =========================
   PROJECT API — /api/projects/*
   src/routes/projects.py  (unchanged)
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

  update: (id: number, data: {
    name: string;
    description?: string;
    grid_width: number;
    grid_height: number;
    cell_size: number;
    project_data: any;
    building_count: number;
    total_floors: number;
  }): Promise<{ id: number; success: boolean }> =>
    pythonRequest(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<{ success: boolean }> =>
    pythonRequest(`/api/projects/${id}`, { method: 'DELETE' }),

  validate: (id: number): Promise<{
    valid: boolean;
    error?: string;
    building_count?: number;
    object_counts?: { walls: number; exits: number; stairs: number; npcs: number; lines: number };
    message?: string;
  }> =>
    pythonRequest(`/api/projects/${id}/validate`, { method: 'GET' }),
};

/* =========================
   SIMULATION API — /api/simulations/*
   src/routes/simulations.py

   CHANGED: run() — project_data removed, project_id now required, disaster_type typed
   ADDED:   progress(), cancel()
========================= */

export const simulationAPI = {
  getAll: (projectId?: number): Promise<Simulation[]> => {
    const qs = projectId ? `?project_id=${projectId}` : '';
    return pythonRequest(`/api/simulations${qs}`, { method: 'GET' });
  },

  getOne: (id: number): Promise<Simulation> =>
    pythonRequest(`/api/simulations/${id}`, { method: 'GET' }),

  // ✅ CHANGED — project_id required, backend fetches project_data itself
  run: (params: {
    project_id: number;
    disaster_type?: DisasterType;   // defaults to 'fire' on backend
    max_steps?: number;
  }): Promise<{ success: boolean; job_id: string }> =>
    pythonRequest('/api/simulations/run', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // ✅ ADDED — poll job status while simulation runs
  progress: (jobId: string): Promise<SimulationJob> =>
    pythonRequest(`/api/simulations/progress/${jobId}`, { method: 'GET' }),

  // ✅ ADDED — cancel a running job
  cancel: (jobId: string): Promise<{ success: boolean }> =>
    pythonRequest(`/api/simulations/cancel/${jobId}`, { method: 'POST' }),

  delete: (id: number): Promise<void> =>
    pythonRequest(`/api/simulations/${id}`, { method: 'DELETE' }),
};

/* =========================
   ANNOUNCEMENT API — /api/announcements/*
   src/routes/announcements.py

   CHANGED: create() — added image_urls, target_group_id, target_heads_only
========================= */

export const announcementAPI = {
  getAll: (): Promise<any[]> =>
    pythonRequest('/api/announcements', { method: 'GET' }),

  // ✅ CHANGED — added targeting fields
  create: (data: {
    title: string;
    content: string;
    image_url?: string;
    image_urls?: string[];
    is_pinned?: boolean;
    target_group_id?: number | null;
    target_heads_only?: boolean;
  }) =>
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
   EVENT API — /api/events/*
   src/routes/events.py

   ADDED: update(), delete()
========================= */

export const eventAPI = {
  getAll: (year?: number, month?: number): Promise<any[]> => {
    const qs = year && month ? `?year=${year}&month=${month}` : '';
    return pythonRequest(`/api/events${qs}`, { method: 'GET' });
  },

  create: (data: {
    title: string;
    description?: string;
    event_type: string;
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

  // ✅ ADDED
  update: (id: number, data: {
    title: string;
    description?: string;
    event_type: string;
    start_time: string;
    end_time: string;
    location?: string;
  }) =>
    pythonRequest(`/api/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // ✅ ADDED
  delete: (id: number) =>
    pythonRequest(`/api/events/${id}`, { method: 'DELETE' }),
};

/* =========================
   INCIDENT API — /api/incidents/*
   src/routes/incidents.py
   ✅ ENTIRELY NEW
========================= */

export const incidentAPI = {
  getAll: (): Promise<any[]> =>
    pythonRequest('/api/incidents', { method: 'GET' }),

  getOne: (id: number): Promise<any> =>
    pythonRequest(`/api/incidents/${id}`, { method: 'GET' }),

  create: (data: {
    title: string;
    description: string;
    incident_type: string;
    severity: string;
    location?: string;
    incident_date: string;
    image_urls?: string[];
  }) =>
    pythonRequest('/api/incidents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addRemark: (incidentId: number, remark: string) =>
    pythonRequest(`/api/incidents/${incidentId}/remarks`, {
      method: 'POST',
      body: JSON.stringify({ remark }),
    }),

  updateStatus: (
    incidentId: number,
    status: 'pending' | 'under_review' | 'resolved' | 'closed'
  ) =>
    pythonRequest(`/api/incidents/${incidentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

/* =========================
   EVALUATION API — /api/evaluations/*
   src/routes/evaluations.py
   ✅ ENTIRELY NEW
========================= */

export const evaluationAPI = {
  pending: (): Promise<any[]> =>
    pythonRequest('/api/evaluations/pending', { method: 'GET' }),

  mine: (): Promise<any[]> =>
    pythonRequest('/api/evaluations/my', { method: 'GET' }),

  submit: (data: {
    event_id: number;
    instructor_name: string;
    program_class?: string;
    classroom_office: string;
    male_count: number;
    female_count: number;
    comments?: string;
    image_urls?: string[];
  }) =>
    pythonRequest('/api/evaluations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  recentDrills: (): Promise<any[]> =>
    pythonRequest('/api/evaluations/recent-drills', { method: 'GET' }),

  forEvent: (eventId: number): Promise<any> =>
    pythonRequest(`/api/evaluations/event/${eventId}`, { method: 'GET' }),
};

/* =========================
   ORGANIZATION API — /api/organization, /api/groups/*
   src/routes/organization.py
   ✅ ENTIRELY NEW
========================= */

export const organizationAPI = {
  get: (): Promise<{ users: UserProfile[]; groups: any[] }> =>
    pythonRequest('/api/organization', { method: 'GET' }),

  getAll: (): Promise<{ users: UserProfile[]; groups: any[] }> =>
    pythonRequest('/api/organization', { method: 'GET' }),

  listGroups: (): Promise<any[]> =>
    pythonRequest('/api/groups', { method: 'GET' }),

  createGroup: (name: string) =>
    pythonRequest('/api/groups', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  deleteGroup: (id: number) =>
    pythonRequest(`/api/groups/${id}`, { method: 'DELETE' }),
};

/* =========================
   LEGACY COMPATIBILITY
   Keep so existing components don't break
========================= */

export const authAPI = {
  login: authService.login,
  signup: authService.signup,
  logout: authService.logout,
};

export const pythonSimulationAPI = simulationAPI;

export const simulationService = {
  runSimulation: () => {
    console.warn('simulationService.runSimulation() is deprecated — use simulationAPI.run({ project_id })');
    return Promise.reject(new Error('Use simulationAPI.run({ project_id, disaster_type })'));
  },
  getMap: () => {
    console.warn('getMap() is deprecated — use projectAPI instead');
    return Promise.resolve({ buildings: [] });
  },
};