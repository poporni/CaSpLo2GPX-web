FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --package-lock=false

COPY . .

EXPOSE 3000

CMD ["npx", "serve", ".", "-l", "tcp://0.0.0.0:3000"]
