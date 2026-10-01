import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { requireAuth } from './middleware.ts';
import { toPublicUser, users } from './users.ts';

/** Example protected resources consumed by the front-end demo screens. */
export const apiRoutes = Router();
apiRoutes.use(requireAuth);

const team = [
  { id: 'm1', name: 'Ana Lima', role: 'Product designer', email: 'ana.lima@exemplo.com' },
  { id: 'm2', name: 'Rafael Moura', role: 'Front-end', email: 'rafael@exemplo.com' },
  { id: 'm3', name: 'João Pedro', role: 'Back-end', email: 'jp@exemplo.com' },
];

const projects = [
  {
    id: 'p1',
    name: 'App de finanças',
    kind: 'mobile',
    status: 'in_progress',
    progress: 62,
    members: [team[0], team[1]],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p2',
    name: 'Site institucional',
    kind: 'web',
    status: 'done',
    progress: 100,
    members: [team[2]],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p3',
    name: 'Painel de vendas (da API)',
    kind: 'dashboard',
    status: 'review',
    progress: 34,
    members: [team[0]],
    updatedAt: new Date().toISOString(),
  },
];

apiRoutes.get('/me', (req, res) => {
  const user = users.findById(req.auth!.userId);
  res.json(
    user
      ? toPublicUser(user, user.googleSub ? 'google' : 'password')
      : { id: req.auth!.userId, email: req.auth!.email ?? null, provider: req.auth!.provider },
  );
});

apiRoutes.get('/dashboard', (_req, res) => {
  res.json({
    activeProjects: projects.length,
    activeProjectsDelta: 1,
    tasksToday: 5,
    urgentTasks: 1,
    completionRate: 88,
  });
});

apiRoutes.get('/projects', (_req, res) => res.json(projects));

apiRoutes.post('/projects', (req, res) => {
  const { name, kind } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ message: 'Name is required.' });
    return;
  }
  const project = {
    id: randomUUID(),
    name: name.trim(),
    kind: typeof kind === 'string' ? kind : 'web',
    status: 'draft',
    progress: 0,
    members: [],
    updatedAt: new Date().toISOString(),
  };
  projects.unshift(project as (typeof projects)[number]);
  res.status(201).json(project);
});

apiRoutes.get('/team', (_req, res) => res.json(team));
