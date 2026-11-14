# Misma versión de Node en todos los equipos; SQLite ya viene integrado.
FROM node:22.20.0-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/tickets.sqlite

# No se necesita npm install: el proyecto solo usa módulos incluidos en Node.
COPY package.json legado_ejemplo.csv ./
COPY src/ ./src/
COPY public/ ./public/
COPY test/ ./test/

# El volumen nuevo hereda este propietario y permite escribir SQLite sin usar root.
RUN mkdir -p /app/data && chown node:node /app/data
USER node

# Una imagen con pruebas fallidas no llega a construirse.
RUN npm test

EXPOSE 3000
CMD ["node", "src/server.js"]
