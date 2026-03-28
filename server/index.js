require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { getDb } = require('./db/database');
const { seedIfEmpty } = require('./db/seed');
const errorHandler = require('./middleware/errorHandler');

const accountsRouter      = require('./routes/accounts');
const transactionsRouter  = require('./routes/transactions');
const importsRouter       = require('./routes/imports');
const reportsRouter       = require('./routes/reports');
const classesRouter          = require('./routes/classes');
const openingBalancesRouter  = require('./routes/openingBalances');
const parseStatementRouter   = require('./routes/parseStatement');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Initialize DB and seed on startup
const db = getDb();
seedIfEmpty(db);

// Routes
app.use('/api/accounts',     accountsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/import',       importsRouter);
app.use('/api/reports',      reportsRouter);
app.use('/api/classes',           classesRouter);
app.use('/api/opening-balances', openingBalancesRouter);
app.use('/api/parse-statement', parseStatementRouter);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`BookKeeping server running on http://localhost:${PORT}`);
});
