# 使用 Node.js 20 作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建生产环境
RUN npm run build

# 安装 serve 用于提供静态文件服务
RUN npm install -g serve

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["serve", "-s", "dist", "-l", "3000"]
