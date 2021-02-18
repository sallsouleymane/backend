FROM node:8.11.1-alpine

WORKDIR /usr/src/app

COPY ./config.json .
COPY ./dbConfig.js .
COPY ./receive.js .
COPY ./controllers/transactions/services/execute.js ./controllers/transactions/services/
COPY ./controllers/transactions/services/queue.js ./controllers/transactions/services/
COPY ./models/TxState.js ./models/
COPY ./services/Blockchain.js ./services/
COPY ./routes/utils/sendSMS.js ./routes/utils/
COPY ./routes/utils/sendMail.js ./routes/utils/
COPY ./routes/utils/doRequest.js ./routes/utils/
COPY ./queue-receiver/package.json .

RUN npm install

CMD [ "node", "receive.js" ]