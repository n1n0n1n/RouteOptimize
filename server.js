const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const users = {
  'admin@demo.com': { email: 'admin@demo.com', role: 'admin', name: 'Admin Master', password: 'password123' },
  'user@demo.com': { email: 'user@demo.com', role: 'user', name: 'Standard User', password: 'password123' }
};

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = users[email];
  if (user && user.password === password) {
    const safeUser = { email: user.email, role: user.role, name: user.name };
    res.json({ success: true, user: safeUser });
  } else {
    res.status(401).json({ success: false, message: 'Unauthorized. Only assigned accounts permitted.' });
  }
});

app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;
  res.json({ success: true, message: `If ${email} exists, a reset link has been sent.` });
});

app.post('/api/route/optimize', (req, res) => {
  const { destination } = req.body;
  res.json({
    success: true,
    message: `System identified heavy traffic along primary highway to ${destination}. Re-routing via alternate express lanes.`,
    savings: { time: '18 mins', fuel: '1.5 Liters' }
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`RouteOptimize Backend running on http://localhost:${PORT}`);
});