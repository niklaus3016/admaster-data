FROM node:20-alpine

WORKDIR /app

# 安装 serve
RUN npm install -g serve

# 复制已构建的 dist 目录
COPY dist ./dist

# 暴露端口
EXPOSE 3003

# 启动命令
CMD ["serve", "-s", "dist", "-l", "3003", "--no-clipboard"]
