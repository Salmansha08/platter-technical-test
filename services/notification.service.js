require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const amqp = require('amqplib/callback_api');
const WebSocket = require('ws');
const app = express();

app.use(bodyParser.json());

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

          notifyUser(data);

          channel.ack(msg);
        }
      });
    });
  });
};

retryConnectRabbitMQ();

// WebSocket Port
const wss = new WebSocket.Server({ port: 9400 });

const notifyUser = (data) => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        message: `Notification for user ${data.userId}: Product ID ${data.productId}, Quantity ${data.qty}, Total Bill: ${data.bill}`
      }));
      console.log(`Sent notification to user ${data.userId}`);
    }
  });
};

// Test Notification WebSocket
app.get('/test-notification', (req, res) => {
  const testNotification = {
    userId: 1,
    productId: 2,
    qty: 3,
    bill: 300000
  };

  notifyUser(testNotification);
  res.status(200).json({ message: 'Test notification sent' });
});

const PORT = 9304;
app.listen(PORT, () => {
  console.log(`Notification service running on port ${PORT}`);
});
