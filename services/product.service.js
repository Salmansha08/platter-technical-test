require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const amqp = require('amqplib/callback_api');
const pgp = require('pg-promise')();
const app = express();

app.use(bodyParser.json());

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

// Get all product
app.get('/products', async (req, res) => {
  try {
    const products = await db.any('SELECT * FROM product');
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get product by ID
app.get('/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const product = await db.oneOrNone('SELECT * FROM product WHERE id = $1', [id]);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json(product);
  } catch (error) {
    console.error('Error fetching product by ID:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add Product
app.post('/products', async (req, res) => {
  const { name, qty, price } = req.body;

  if (!name || qty === undefined || !price) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const newProduct = await db.one(
      'INSERT INTO product (name, qty, price) VALUES ($1, $2, $3) RETURNING *',
      [name, qty, price]
    );

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update product by ID
app.put('/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, qty, price } = req.body;

  try {
    const product = await db.oneOrNone('SELECT * FROM product WHERE id = $1', [id]);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const updatedProduct = await db.one(
      'UPDATE product SET name = $1, qty = $2, price = $3 WHERE id = $4 RETURNING *',
      [name || product.name, qty !== undefined ? qty : product.qty, price || product.price, id]
    );

    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete product by ID
app.delete('/products/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const product = await db.oneOrNone('SELECT * FROM product WHERE id = $1', [id]);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await db.none('DELETE FROM product WHERE id = $1', [id]);
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Checkout product
app.post('/products/check-out', async (req, res) => {
  const { productId, qty } = req.body;

  try {
    const product = await db.oneOrNone('SELECT * FROM product WHERE id = $1', [productId]);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.qty < qty) {
      return res.status(400).json({ message: 'Insufficient product quantity' });
    }

    await db.tx(async t => {
      await t.none('UPDATE product SET qty = qty - $1 WHERE id = $2', [qty, productId]);

      amqp.connect(`amqp://rabbit:${process.env.RABBITMQ_DEFAULT_PASS}@rabbitmq_container`, (error0, connection) => {
        if (error0) {
          console.error('Failed to connect to RabbitMQ', error0);
          return;
        }

        connection.createChannel((error1, channel) => {
          if (error1) {
            console.error('Failed to create channel', error1);
            return;
          }

          const queue = 'M!PAYMENT';
          const msg = {
            productId: product.id,
            productName: product.name,
            qty: qty,
            price: product.price,
          };

          channel.assertQueue(queue, { durable: true });
          channel.sendToQueue(queue, Buffer.from(JSON.stringify(msg)), { persistent: true });

          console.log(' [x] Sent %s', JSON.stringify(msg));
          setTimeout(() => connection.close(), 500);
        });
      });

      res.status(200).json({ message: 'Product checkout successful' });
    });

  } catch (error) {
    console.error('Error during checkout:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

const PORT = 9301;
app.listen(PORT, () => {
  console.log(`Product service running on port ${PORT}`);
});
