# node:20-slim (Debian) en vez de alpine: bcrypt compila un módulo nativo y en musl (alpine) a
# veces no encuentra un binario ya compilado y necesita gcc/make - con Debian se evita ese riesgo.
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Usuario sin privilegios (ya viene creado en la imagen oficial de Node)
RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "src/server.js"]
