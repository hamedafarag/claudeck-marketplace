// Mock Claudeck API for Showcase
// Returns demo data for all ctx.api.* functions plugins may call.
// Uses a Proxy to catch unknown function calls gracefully.

// ── In-memory state (for interactive mutators) ──────────

let _nextId = 100;

const todos = [
  { id: 1, text: 'Review PR for authentication module', done: false, priority: 2, archived: false, created_at: '2026-04-01T10:00:00Z' },
  { id: 2, text: 'Write unit tests for API endpoints', done: false, priority: 1, archived: false, created_at: '2026-04-01T11:00:00Z' },
  { id: 3, text: 'Update documentation for v2 release', done: true, priority: 0, archived: false, created_at: '2026-03-30T09:00:00Z' },
  { id: 4, text: 'Deploy staging environment', done: true, priority: 1, archived: true, created_at: '2026-03-28T14:00:00Z' },
];

const brags = [
  { id: 1, todo_id: 3, summary: 'Completed full API documentation rewrite covering 40+ endpoints', created_at: '2026-04-01T16:00:00Z' },
];

const repos = {
  groups: [
    { id: 1, name: 'Frontend', parent_id: null },
    { id: 2, name: 'Backend', parent_id: null },
  ],
  repos: [
    { id: 1, name: 'claudeck', path: '/projects/claudeck', group_id: 1, url: 'https://github.com/hamedafarag/claudeck' },
    { id: 2, name: 'api-server', path: '/projects/api-server', group_id: 2, url: '' },
    { id: 3, name: 'design-system', path: '/projects/design-system', group_id: 1, url: '' },
  ],
};

const linearIssues = [
  { id: 'i1', identifier: 'ENG-42', title: 'Add dark mode toggle', state: { name: 'In Progress', type: 'started', color: '#f2c94c' }, priority: 2, assignee: { name: 'Demo User' }, labels: [{ name: 'feature', color: '#33d17a' }], url: '#' },
  { id: 'i2', identifier: 'ENG-43', title: 'Fix mobile nav overflow', state: { name: 'Todo', type: 'unstarted', color: '#bbb' }, priority: 1, assignee: { name: 'Demo User' }, labels: [{ name: 'bug', color: '#ed333b' }], url: '#' },
  { id: 'i3', identifier: 'ENG-44', title: 'Upgrade to Node 22', state: { name: 'Done', type: 'completed', color: '#33d17a' }, priority: 0, assignee: null, labels: [{ name: 'infra', color: '#7b9bf5' }], url: '#' },
];

// ── Known API function mocks ────────────────────────────

const mocks = {
  // Projects
  async fetchProjects() {
    return [{ name: 'Demo Project', path: '/demo/claudeck-project' }];
  },

  // Sessions
  async fetchSessions() { return []; },
  async searchSessions() { return []; },
  async fetchActiveSessionIds() { return []; },
  async fetchMessages() { return []; },
  async fetchMessagesByChatId() { return []; },
  async fetchSingleMessages() { return []; },

  // Stats
  async fetchStats() { return { totalSessions: 42, totalMessages: 1337, totalTokens: 500000 }; },
  async fetchHomeData() { return { sessions: [], stats: {} }; },
  async fetchDashboard() { return { sessions: [], stats: {} }; },
  async fetchAnalytics() { return { daily: [], weekly: [] }; },
  async fetchAccountInfo() { return { email: 'demo@claudeck.dev', plan: 'Pro' }; },
  async fetchAgentMetrics() { return { runs: [] }; },

  // Prompts
  async fetchPrompts() { return []; },
  async createPrompt() { return { id: _nextId++ }; },
  async deletePromptApi() { return { ok: true }; },

  // Workflows
  async fetchWorkflows() { return []; },
  async createWorkflow() { return { id: _nextId++ }; },
  async updateWorkflow() { return { ok: true }; },
  async deleteWorkflowApi() { return { ok: true }; },

  // Agents
  async fetchAgents() { return []; },
  async createAgent() { return { id: _nextId++ }; },
  async updateAgent() { return { ok: true }; },
  async deleteAgentApi() { return { ok: true }; },

  // Chains / DAGs
  async fetchChains() { return []; },
  async createChain() { return { id: _nextId++ }; },
  async updateChain() { return { ok: true }; },
  async deleteChainApi() { return { ok: true }; },
  async fetchDags() { return []; },
  async createDag() { return { id: _nextId++ }; },
  async updateDag() { return { ok: true }; },
  async deleteDagApi() { return { ok: true }; },
  async fetchAgentContext() { return {}; },

  // Files
  async browseFolders() { return []; },
  async addProject() { return { ok: true }; },
  async deleteProject() { return { ok: true }; },
  async fetchProjectCommands() { return []; },
  async fetchFiles() { return []; },
  async fetchFileContent() {
    return { content: '# CLAUDE.md\n\nThis is a demo Claudeck project.\n\n## Instructions\n\n- Use Tab SDK for plugins\n- Follow the contribution guide\n- Have fun building!\n' };
  },
  async writeFileContent() { return { ok: true }; },
  async fetchFileTree() { return { tree: [] }; },
  async searchFiles() { return []; },

  // MCP
  async fetchMcpServers() { return []; },
  async saveMcpServer() { return { ok: true }; },
  async deleteMcpServer() { return { ok: true }; },

  // Sessions management
  async updateSessionTitle() { return { ok: true }; },
  async deleteSessionApi() { return { ok: true }; },
  async toggleSessionPin() { return { ok: true }; },
  async generateSummary() { return { summary: 'Demo session summary' }; },
  async forkSession() { return { id: 'fork-001' }; },
  async fetchBranches() { return []; },
  async fetchLineage() { return []; },
  async saveSystemPromptApi() { return { ok: true }; },
  async execCommand() { return { stdout: 'demo output', stderr: '', exitCode: 0 }; },

  // Linear
  async fetchLinearIssues() { return linearIssues; },
  async fetchLinearTeams() { return [{ id: 't1', name: 'Engineering', key: 'ENG' }]; },
  async fetchLinearTeamStates(teamId) {
    return [
      { id: 's1', name: 'Todo', type: 'unstarted', color: '#bbb' },
      { id: 's2', name: 'In Progress', type: 'started', color: '#f2c94c' },
      { id: 's3', name: 'Done', type: 'completed', color: '#33d17a' },
    ];
  },
  async createLinearIssue(data) {
    const issue = { id: `i${_nextId++}`, identifier: `ENG-${_nextId}`, title: data?.title || 'New issue', url: '#' };
    return { success: true, issue };
  },
  async fetchLinearConfig() {
    return { apiKey: 'lin_api_****demo', assigneeEmail: 'demo@claudeck.dev' };
  },
  async saveLinearConfig() { return { ok: true }; },
  async testLinearConnection() {
    return { ok: true, user: { name: 'Demo User', email: 'demo@claudeck.dev' } };
  },

  // Tips
  async fetchTips() { return []; },
  async fetchRssFeed() { return []; },

  // Tasks (interactive with in-memory state)
  async fetchTodoCounts() {
    const active = todos.filter(t => !t.archived).length;
    const archived = todos.filter(t => t.archived).length;
    return { active, archived };
  },
  async fetchTodos(archived = false) {
    return todos.filter(t => t.archived === archived);
  },
  async createTodoApi(text) {
    const todo = { id: _nextId++, text, done: false, priority: 0, archived: false, created_at: new Date().toISOString() };
    todos.push(todo);
    return todo;
  },
  async updateTodoApi(id, data) {
    const todo = todos.find(t => t.id === id);
    if (todo) Object.assign(todo, data);
    return { ok: true };
  },
  async deleteTodoApi(id) {
    const idx = todos.findIndex(t => t.id === id);
    if (idx !== -1) todos.splice(idx, 1);
    return { ok: true };
  },
  async archiveTodoApi(id, archived = true) {
    const todo = todos.find(t => t.id === id);
    if (todo) todo.archived = archived;
    return { ok: true };
  },
  async bragTodoApi(id, summary) {
    const brag = { id: _nextId++, todo_id: id, summary, created_at: new Date().toISOString() };
    brags.push(brag);
    return brag;
  },
  async fetchBrags() { return brags; },
  async deleteBragApi(id) {
    const idx = brags.findIndex(b => b.id === id);
    if (idx !== -1) brags.splice(idx, 1);
    return { ok: true };
  },

  // Repos (interactive)
  async fetchRepos() { return repos; },
  async addRepo(name, path, groupId, url) {
    const repo = { id: _nextId++, name, path, group_id: groupId, url: url || '' };
    repos.repos.push(repo);
    return repo;
  },
  async updateRepo(id, updates) {
    const repo = repos.repos.find(r => r.id === id);
    if (repo) Object.assign(repo, updates);
    return { ok: true };
  },
  async deleteRepo(id) {
    const idx = repos.repos.findIndex(r => r.id === id);
    if (idx !== -1) repos.repos.splice(idx, 1);
    return { ok: true };
  },
  async createRepoGroup(name, parentId) {
    const group = { id: _nextId++, name, parent_id: parentId || null };
    repos.groups.push(group);
    return group;
  },
  async updateRepoGroup(id, updates) {
    const group = repos.groups.find(g => g.id === id);
    if (group) Object.assign(group, updates);
    return { ok: true };
  },
  async deleteRepoGroup(id) {
    const idx = repos.groups.findIndex(g => g.id === id);
    if (idx !== -1) repos.groups.splice(idx, 1);
    return { ok: true };
  },

  // Skills
  async fetchSkillsConfig() { return {}; },
  async saveSkillsConfig() { return { ok: true }; },
  async searchSkills() { return []; },
  async aiSearchSkills() { return []; },
  async fetchInstalledSkills() { return []; },
  async installSkill() { return { ok: true }; },
  async uninstallSkill() { return { ok: true }; },
  async toggleSkill() { return { ok: true }; },
};

// ── Proxy: catch-all for unknown API calls ──────────────

export default new Proxy(mocks, {
  get(target, prop) {
    if (prop in target) return target[prop];
    // Return a function that logs and returns empty
    return async (...args) => {
      console.warn(`[showcase] ctx.api.${String(prop)}() called — no mock available`, args);
      return {};
    };
  },
});

// Also export individually for direct imports
export const {
  fetchProjects, fetchSessions, fetchTodos, fetchTodoCounts,
  fetchRepos, fetchLinearIssues, fetchFileContent, writeFileContent,
  fetchBrags, fetchLinearConfig, fetchLinearTeams,
} = mocks;
