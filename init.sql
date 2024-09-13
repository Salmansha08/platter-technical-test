CREATE DATABASE product;
CREATE DATABASE user_service;
CREATE DATABASE payment;

\c product;
CREATE TABLE product (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    qty INT,
    price BIGINT
);

INSERT INTO product (name, qty, price) VALUES ('Sepatu', 10, 100000);
INSERT INTO product (name, qty, price) VALUES ('Baju', 20, 150000);
INSERT INTO product (name, qty, price) VALUES ('Celana', 15, 200000);

\c user_service;
CREATE TABLE user (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    alamat TEXT
);

INSERT INTO user (name, alamat) VALUES ('Frank', 'Jakarta');
INSERT INTO user (name, alamat) VALUES ('Sarah', 'Bandung');
INSERT INTO user (name, alamat) VALUES ('John', 'Surabaya');

\c payment;
CREATE TABLE payment (
    id SERIAL PRIMARY KEY,
    paymentAt TIMESTAMPTZ,
    userId INT,
    productId INT,
    price BIGINT,
    qty INT,
    bill BIGINT
);

INSERT INTO payment (paymentAt, userId, productId, price, qty, bill) 
VALUES (NOW(), 1, 1, 100000, 2, 200000);
INSERT INTO payment (paymentAt, userId, productId, price, qty, bill) 
VALUES (NOW(), 2, 2, 150000, 1, 150000);
