// Auto-generated mock for tasks plugin
const todos = [
  { id: 1, text: 'Review PR for authentication module', done: false, priority: 2, archived: false },
  { id: 2, text: 'Write unit tests for API endpoints', done: false, priority: 1, archived: false },
  { id: 3, text: 'Update documentation for v2 release', done: true, priority: 0, archived: false },
];

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') return res.json(todos);
  if (req.method === 'POST') {
    const todo = { id: Date.now(), text: req.body?.text || 'New task', done: false, priority: 0 };
    todos.push(todo);
    return res.json(todo);
  }
  res.json({ ok: true });
}
