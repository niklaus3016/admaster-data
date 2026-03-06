FROM nginx:alpine

# 复制构建好的 dist 目录到 nginx 目录
COPY dist /usr/share/nginx/html

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制 entrypoint 脚本
COPY entrypoint.sh /home/devbox/project/entrypoint.sh
RUN chmod +x /home/devbox/project/entrypoint.sh

# 暴露端口
EXPOSE 3003

# 使用 entrypoint 脚本启动
ENTRYPOINT ["/home/devbox/project/entrypoint.sh"]
