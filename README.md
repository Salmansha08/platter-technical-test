
# Platter Technical Test

- **Services**:
  - Product (Port: 9301)
  - Payment (Port: 9302)
  - User (Port: 9303)
  - Notification (Port: 9304)
- **Database**: PostgreSQL
- **Containerization**: Docker
- **Service Communication**: RabbitMQ (Message Broker)

## Installation

1. Clone repository:

   ```bash
   git clone https://github.com/Salmansha08/platter-technical-test.git
   cd platter-technical-test
   ```

2. Instal all dependencies **npm**:

   ```bash
   npm install
   ```

3. Create `.env`, example:

   ```env
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=pass-postgres
   POSTGRES_DB=product,user,payment
   RABBITMQ_DEFAULT_USER=rabbit
   RABBITMQ_DEFAULT_PASS=pass-rabbit
   ```

## Run APP

1. Docker Compose Build:

   ```bash
   docker-compose up --build -d
   ```

## API Documentation

### Product Service

- **GET** `/products`: Get All Products.
- **GET** `/products/:id`: Get Products by Id.
- **POST** `/products`: Create Products.
- **PUT** `/products/:id`: Edit Products by Id.
- **DELETE** `/products/:id`: Delete Products by Id.
- **POST** `/products/check-out`: Checkout a product and reduce the product quantity.

### User Service

- **GET** `/users`: Get All users.
- **GET** `/users/:id`: Get users by Id.
- **POST** `/users`: Create users.
- **PUT** `/users/:id`: Edit users by Id.
- **DELETE** `/users/:id`: Delete users by Id.

### Payment Service

- Handled via RabbitMQ based on the data received from Product Service.

### Notification Service

- **GET** `/test-notification`: Test WebSocket.
- Sends notifications to the User Service using WebSocket.
