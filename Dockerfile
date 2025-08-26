FROM node:18-alpine

# پوشه کاری
WORKDIR /app

# فقط package.json و lockfile رو کپی کن
COPY package*.json ./

# نصب پکیج‌ها
RUN npm install --legacy-peer-deps

# حالا کل سورس‌کد رو کپی کن
COPY . .

# نصب nestjs/cli به‌صورت local بهتره (نه global)
# ولی اگه اصرار داری global باشه، بمونه
RUN npm install -g @nestjs/cli

# اجرای پروژه در حالت dev
CMD ["npm", "run", "start:dev"]
