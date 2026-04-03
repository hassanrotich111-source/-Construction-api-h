const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());

let db = {
  users: [],
  attendanceRecords: [],
  itemsBought: [],
  itemsUsed: [],
  mealRecords: [],
  paymentRecords: [],
  issueReports: [],
  cookPayments: [],
  settings: {
    adminPassword: 'admin123',
    attendantPassword: 'attendant123',
    cookPassword: 'cook123',
    commonWorkerPassword: 'worker123',
    lastPaymentDate: null
  }
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      db = JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

function initializeData() {
  const adminExists = db.users.find(u => u.role === 'admin');
  if (!adminExists) {
    db.users.push({
      id: 'admin-1',
      name: 'Rotich',
      password: 'admin123',
      role: 'admin',
      createdAt: new Date().toISOString()
    });
    saveData();
  }
}

loadData();
initializeData();

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Users
app.get('/api/users', (req, res) => res.json(db.users));

app.post('/api/login', (req, res) => {
  const { name, password, role } = req.body;
  if (role === 'admin') {
    const user = db.users.find(u => u.role === 'admin' && u.name === 'Rotich');
    if (user && password === db.settings.adminPassword) return res.json(user);
  } else if (role === 'attendant') {
    if (password === db.settings.attendantPassword) {
      let user = db.users.find(u => u.role === 'attendant');
      if (!user) {
        user = { id: generateId(), name: name || 'Attendant', password, role: 'attendant', createdAt: new Date().toISOString() };
        db.users.push(user); saveData();
      }
      return res.json(user);
    }
  } else if (role === 'cook') {
    if (password === db.settings.cookPassword) {
      let user = db.users.find(u => u.role === 'cook');
      if (!user) {
        user = { id: generateId(), name: name || 'Cook', password, role: 'cook', createdAt: new Date().toISOString() };
        db.users.push(user); saveData();
      }
      return res.json(user);
    }
  } else if (role === 'worker') {
    const user = db.users.find(u => u.name === name && u.role === 'worker');
    if (user && password === db.settings.commonWorkerPassword) return res.json(user);
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/users', (req, res) => {
  const user = { id: generateId(), ...req.body, role: 'worker', createdAt: new Date().toISOString() };
  db.users.push(user); saveData(); res.json(user);
});

app.put('/api/users/:id', (req, res) => {
  const index = db.users.findIndex(u => u.id === req.params.id);
  if (index >= 0) { db.users[index] = { ...db.users[index], ...req.body }; saveData(); res.json(db.users[index]); }
  else res.status(404).json({ error: 'User not found' });
});

app.delete('/api/users/:id', (req, res) => {
  db.users = db.users.filter(u => u.id !== req.params.id); saveData(); res.json({ message: 'User deleted' });
});

// Attendance
app.get('/api/attendance', (req, res) => res.json(db.attendanceRecords));
app.get('/api/attendance/:date', (req, res) => res.json(db.attendanceRecords.filter(r => r.date === req.params.date)));

app.post('/api/attendance/:date', (req, res) => {
  const { date } = req.params;
  const { records, submittedBy, startTime, endTime, remarks, workDone } = req.body;
  db.attendanceRecords = db.attendanceRecords.filter(r => r.date !== date);
  const newRecords = records.map(r => ({ id: generateId(), ...r, date, submittedBy, startTime, endTime, remarks, workDone, submittedAt: new Date().toISOString() }));
  db.attendanceRecords.push(...newRecords); saveData(); res.json(newRecords);
});

// Items Bought
app.get('/api/items-bought', (req, res) => res.json(db.itemsBought));
app.get('/api/items-bought/:date', (req, res) => res.json(db.itemsBought.filter(i => i.date === req.params.date)));

app.post('/api/items-bought/:date', (req, res) => {
  const { date } = req.params;
  const { items, submittedBy, moneyGiven, amountGiven } = req.body;
  db.itemsBought = db.itemsBought.filter(i => i.date !== date);
  const newItems = items.map(i => ({ id: generateId(), ...i, date, submittedBy, moneyGiven, amountGiven }));
  db.itemsBought.push(...newItems); saveData(); res.json(newItems);
});

// Items Used
app.get('/api/items-used', (req, res) => res.json(db.itemsUsed));
app.get('/api/items-used/:date', (req, res) => res.json(db.itemsUsed.filter(i => i.date === req.params.date)));

app.post('/api/items-used/:date', (req, res) => {
  const { date } = req.params;
  const { items, submittedBy } = req.body;
  db.itemsUsed = db.itemsUsed.filter(i => i.date !== date);
  const newItems = items.map(i => {
    const boughtItems = db.itemsBought.filter(b => b.item.toLowerCase().trim() === i.item.toLowerCase().trim());
    const totalBought = boughtItems.reduce((sum, b) => sum + b.price, 0);
    const totalBoughtQty = boughtItems.reduce((sum, b) => sum + (parseFloat(b.quantity) || 0), 0);
    const unitPrice = totalBoughtQty > 0 ? totalBought / totalBoughtQty : 0;
    const qty = parseFloat(i.quantity) || 0;
    return { id: generateId(), ...i, date, submittedBy, unitPrice, price: unitPrice * qty };
  });
  db.itemsUsed.push(...newItems); saveData(); res.json(newItems);
});

// Meals
app.get('/api/meals', (req, res) => res.json(db.mealRecords));
app.get('/api/meals/:date', (req, res) => res.json(db.mealRecords.find(m => m.date === req.params.date) || null));

app.post('/api/meals/:date', (req, res) => {
  const { date } = req.params;
  const { tea, mandazi, lunch, tea2, submittedBy } = req.body;
  const total = tea + mandazi + lunch + tea2;
  const itemsUsed = db.itemsUsed.filter(i => i.date === date);
  const totalItemsCost = itemsUsed.reduce((sum, i) => sum + (i.price || 0), 0);
  const profit = total - totalItemsCost;
  db.mealRecords = db.mealRecords.filter(m => m.date !== date);
  const newRecord = { id: generateId(), date, tea, mandazi, lunch, tea2, total, profit, submittedBy };
  db.mealRecords.push(newRecord); saveData(); res.json(newRecord);
});

// Payments
app.get('/api/payments', (req, res) => res.json(db.paymentRecords));
app.get('/api/payments/worker/:workerId', (req, res) => res.json(db.paymentRecords.filter(p => p.workerId === req.params.workerId)));

app.post('/api/payments', (req, res) => {
  const payment = { id: generateId(), ...req.body, processedAt: new Date().toISOString() };
  db.paymentRecords.push(payment);
  db.settings.lastPaymentDate = req.body.toDate; saveData(); res.json(payment);
});

// Issues
app.get('/api/issues', (req, res) => res.json(db.issueReports));
app.get('/api/issues/worker/:workerId', (req, res) => res.json(db.issueReports.filter(i => i.workerId === req.params.workerId)));

app.post('/api/issues', (req, res) => {
  const issue = { id: generateId(), ...req.body, status: 'pending', date: new Date().toISOString() };
  db.issueReports.push(issue); saveData(); res.json(issue);
});

app.put('/api/issues/:id/resolve', (req, res) => {
  const index = db.issueReports.findIndex(i => i.id === req.params.id);
  if (index >= 0) { db.issueReports[index].status = 'resolved'; saveData(); res.json(db.issueReports[index]); }
  else res.status(404).json({ error: 'Issue not found' });
});

// Cook Payments
app.get('/api/cook-payments', (req, res) => res.json(db.cookPayments));

app.post('/api/cook-payments', (req, res) => {
  const payment = { id: generateId(), ...req.body, date: new Date().toISOString() };
  db.cookPayments.push(payment); saveData(); res.json(payment);
});

// Settings
app.get('/api/settings', (req, res) => res.json(db.settings));
app.get('/api/settings/:key', (req, res) => res.json(db.settings[req.params.key] || null));

app.put('/api/settings/:key', (req, res) => {
  db.settings[req.params.key] = req.body.value; saveData();
  res.json({ key: req.params.key, value: req.body.value });
});

// Stats
app.get('/api/stats', (req, res) => {
  res.json({
    workers: db.users.filter(u => u.role === 'worker'),
    attendanceRecords: db.attendanceRecords,
    itemsBought: db.itemsBought,
    itemsUsed: db.itemsUsed,
    mealRecords: db.mealRecords,
    paymentRecords: db.paymentRecords,
    issueReports: db.issueReports,
    cookPayments: db.cookPayments,
    settings: db.settings,
    lastPaymentDate: db.settings.lastPaymentDate
  });
});

// Inventory
app.get('/api/inventory', (req, res) => {
  const inventory = {};
  db.itemsBought.forEach(item => {
    const name = item.item.toLowerCase().trim();
    if (!inventory[name]) inventory[name] = { itemName: item.item, totalBoughtQty: 0, totalUsedQty: 0, remainingQty: 0, totalSpent: 0, unitPrice: 0 };
    const qty = parseFloat(item.quantity) || 0;
    inventory[name].totalBoughtQty += qty;
    inventory[name].totalSpent += item.price;
  });
  db.itemsUsed.forEach(item => {
    const name = item.item.toLowerCase().trim();
    if (!inventory[name]) inventory[name] = { itemName: item.item, totalBoughtQty: 0, totalUsedQty: 0, remainingQty: 0, totalSpent: 0, unitPrice: 0 };
    const qty = parseFloat(item.quantity) || 0;
    inventory[name].totalUsedQty += qty;
  });
  Object.values(inventory).forEach((item) => {
    item.remainingQty = item.totalBoughtQty - item.totalUsedQty;
    item.unitPrice = item.totalBoughtQty > 0 ? item.totalSpent / item.totalBoughtQty : 0;
  });
  res.json(Object.values(inventory));
});
app.get('/', (req, res) => {
  res.send('API is running 🚀');
});
app.get('/', (req, res) => {
  res.send('API is running');
});
app.get('/latest', (req, res) => {
  res.json({ message: "Latest endpoint working" });
});
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
