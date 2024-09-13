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

\c user_service;
CREATE TABLE user (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    alamat TEXT
);

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