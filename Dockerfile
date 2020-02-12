FROM node:12.15.0-alpine3.9

WORKDIR /app

CMD nodejs index.js

COPY package.json yarn.lock /app/

RUN apk --no-cache --virtual .deps add python make g++ linux-headers && \
    yarn && \
    apk del .deps

COPY . /app

WORKDIR /app/modbus
