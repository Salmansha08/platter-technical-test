require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const pgp = require('pg-promise')();
const jwt = require('jsonwebtoken');
const amqp = require('amqplib/callback_api');
const app = express();

app.use(bodyParser.json());

const db = pgp({
  connectionString: process.env.DATABASE_URL,
});

// const authenticateToken = (req, res, next) => {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];
  
//   if (!token) return res.sendStatus(401);

//   jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
//     if (err) return res.sendStatus(403);
//     req.user = user;
//     next();
//   });
// };

const connectWithRetry = async () => {
  try {
    await db.connect();
    console.log('Database connected');
  } catch (err) {
    console.error('Failed to connect to database, retrying in 5 seconds...', err);
    setTimeout(connectWithRetry, 5000);
  }
};
connectWithRetry();

// Get all users
app.get('/users', async (req, res) => {
  try {
    const users = await db.any('SELECT * FROM "user"');
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user by ID
app.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const user = await db.oneOrNone('SELECT * FROM "user" WHERE id = $1', [id]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new user
app.post('/users', async (req, res) => {
  const { name, alamat } = req.body;
  
  if (!name || !alamat) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const newUser = await db.one(
      'INSERT INTO "user" (name, alamat) VALUES ($1, $2) RETURNING *',
      [name, alamat]
    );
    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating new user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user by ID
app.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, alamat } = req.body;

  try {
    const user = await db.oneOrNone('SELECT * FROM "user" WHERE id = $1', [id]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedUser = await db.one(
      'UPDATE "user" SET name = $1, alamat = $2 WHERE id = $3 RETURNING *',
      [name || user.name, alamat || user.alamat, id]
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete user
app.delete('/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const user = await db.oneOrNone('SELECT * FROM "user" WHERE id = $1', [id]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await db.none('DELETE FROM "user" WHERE id = $1', [id]);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

const RABBITMQ_USER = process.env.RABBITMQ_DEFAULT_USER;
const RABBITMQ_PASS = process.env.RABBITMQ_DEFAULT_PASS;

const retryConnectRabbitMQ = (retryCount = 0) => {
  const maxRetries = 10;
  const retryDelay = 5000;

  amqp.connect(`amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@rabbitmq_container:5672`, (error0, connection) => {
    if (error0) {
      console.error(`Failed to connect to RabbitMQ (retry ${retryCount + 1}/${maxRetries}):`, error0);
      if (retryCount < maxRetries) {
        setTimeout(() => retryConnectRabbitMQ(retryCount + 1), retryDelay);
      } else {
        console.error("Max retry attempts reached. Could not connect to RabbitMQ.");
      }
      return;
    }

    connection.createChannel((error1, channel) => {
      if (error1) {
        console.error('Failed to create channel', error1);
        return;
      }

      const queue = 'E!SEND_SOCKET';
      channel.assertQueue(queue, { durable: true });

      console.log(' [*] Waiting for messages in %s. To exit press CTRL+C', queue);

      channel.consume(queue, (msg) => {
        if (msg !== null) {
          const data = JSON.parse(msg.content.toString());
          console.log(" [x] Received notification:", data);

          // Here you would handle the WebSocket logic to send notification to the user
          // For now, just log it to the console
          console.log(`Sending notification to user with ID: ${data.userId}`);

          channel.ack(msg);
        }
      });
    });
  });
};

retryConnectRabbitMQ();

const PORT = 9303;
app.listen(PORT, () => {
  console.log(`User service running on port ${PORT}`);
});
