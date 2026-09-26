# node:20-slim (Debian) en vez de alpine: bcrypt compila un módulo nativo y en musl (alpine) a
# veces no encuentra un binario ya compilado y necesita gcc/make - con Debian se evita ese riesgo.
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node . .

# Usuario sin privilegios (ya viene creado en la imagen oficial de Node). Se asigna el dueño
# directo en los COPY de arriba en vez de un "RUN chown -R" aparte al final: recorrer todo /app
# archivo por archivo después de copiado tardaba ~30s de más en cada build.
USER node

EXPOSE 3000
CMD ["node", "src/server.js"]
