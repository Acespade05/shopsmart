FROM node:22-alpine

# stress-ng lets the AI-SRE agent inject bounded memory/CPU/disk load INSIDE this
# container (via docker exec), so a restart cleanly reclaims it. Chaos-lab only.
RUN apk add --no-cache stress-ng

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "src/app.js"]
