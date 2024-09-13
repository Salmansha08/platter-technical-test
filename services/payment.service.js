require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const amqp = require('amqplib/callback_api');
const pgp = require('pg-promise')();
const app = express();

app.use(bodyParser.json());

const RABBITMQ_USER = process.env.RABBITMQ_DEFAULT_USER;
const RABBITMQ_PASS = process.env.RABBITMQ_DEFAULT_PASS;

const db = pgp({
  connectionString: process.env.DATABASE_URL,
});

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

const retryConnectRabbitMQ = (retryCount = 0) => {
  const maxRetries = 20;
  const retryDelay = 10000;
  
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

      const queue = 'M!PAYMENT';
      channel.assertQueue(queue, { durable: true });

      console.log(' [*] Waiting for messages in %s. To exit press CTRL+C', queue);

      channel.consume(queue, async (msg) => {
        if (msg !== null) {
          const data = JSON.parse(msg.content.toString());
          console.log(" [x] Received message:", data);

          const { productId, productName, qty, price } = data;
          const totalBill = price * qty;

          try {
            const paymentRecord = await db.one(
              `INSERT INTO payment (paymentAt, userId, productId, price, qty, bill) 
              VALUES (NOW(), $1, $2, $3, $4, $5) RETURNING *`,
              [data.userId, productId, price, qty, totalBill]
            );

            console.log('Payment record inserted:', paymentRecord);

            const notificationQueue = 'E!SEND_SOCKET';
            const notificationMsg = {
              userId: data.userId,
              productId: productId,
              qty: qty,
              bill: totalBill,
            };

            channel.assertQueue(notificationQueue, { durable: true });
            channel.sendToQueue(notificationQueue, Buffer.from(JSON.stringify(notificationMsg)), { persistent: true });

            console.log(' [x] Sent notification to Notification service:', notificationMsg);
          } catch (error) {
            console.error('Failed to process payment:', error);
          }

          channel.ack(msg);
        }
      });
    });
  });
};

retryConnectRabbitMQ();

const PORT = 9302;
app.listen(PORT, () => {
  console.log(`Payment service running on port ${PORT}`);
});
