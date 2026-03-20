// types/navigation.ts

export type Page =
  | 'home'
  | 'organization'   // ← new — org chart, visible to all roles
  | 'simulations'
  | 'create'
  | 'projects'
  | 'users'
  | 'events'
  | 'incidents';