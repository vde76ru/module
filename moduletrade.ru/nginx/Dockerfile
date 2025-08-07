FROM nginx:alpine

# Копируем конфигурационные файлы
COPY nginx.conf /etc/nginx/nginx.conf
COPY api_cors.conf /etc/nginx/api_cors.conf
COPY conf.d /etc/nginx/conf.d/

# Создаем директорию для сертификатов
RUN mkdir -p /etc/nginx/certs

# Проверяем конфигурацию
RUN nginx -t

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]