FROM node:12
WORKDIR /var/app
COPY package.json /var/app
RUN npm install
COPY . /var/app
CMD node index.js
EXPOSE 3001
