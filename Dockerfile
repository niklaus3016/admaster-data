# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装所有依赖（包括 devDependencies）
RUN npm ci 2>&1 || (cat /root/.npm/_logs/*.log && exit 1)

# 复制源代码
COPY . .

# 构建生产环境
RUN npm run build 2>&1 || (echo "Build failed" && exit 1)

# 检查 dist 目录是否存在
RUN ls -la dist/ || (echo "dist directory not found" && exit 1)

# 生产阶段
FROM node:20-alpine

WORKDIR /app

# 安装 serve 用于提供静态文件服务
RUN npm install -g serve

# 从构建阶段复制 dist 目录
COPY --from=builder /app/dist ./dist

# 暴露端口
EXPOSE 3003

# 启动命令
CMD ["serve", "-s", "dist", "-l", "3003", "--no-clipboard"]
