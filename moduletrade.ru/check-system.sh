#!/bin/bash

echo "🔍 Проверка состояния системы ModuleTrade..."
echo "============================================"

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Функции вывода
print_header() {
    echo -e "\n${BLUE}▶ $1${NC}"
    echo "-------------------"
}

print_ok() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

# Проверка Docker
print_header "Docker Status"
if docker --version > /dev/null 2>&1; then
    print_ok "Docker установлен: $(docker --version)"
else
    print_error "Docker не установлен"
    exit 1
fi

if docker compose version > /dev/null 2>&1; then
    print_ok "Docker Compose установлен: $(docker compose version)"
else
    print_error "Docker Compose не установлен"
    exit 1
fi

# Проверка контейнеров
print_header "Состояние контейнеров"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.State}}" | while read line; do
    if [[ $line == *"Up"* ]] && [[ $line == *"running"* ]]; then
        echo -e "${GREEN}✓${NC} $line"
    elif [[ $line == *"NAME"* ]]; then
        echo "$line"
    else
        echo -e "${RED}✗${NC} $line"
    fi
done

# Проверка здоровья сервисов
print_header "Здоровье сервисов"
for service in postgres redis rabbitmq backend frontend nginx; do
    health=$(docker compose ps $service --format json 2>/dev/null | grep -o '"Health":"[^"]*"' | cut -d'"' -f4)
    if [ "$health" = "healthy" ]; then
        print_ok "$service: healthy"
    elif [ -z "$health" ]; then
        status=$(docker compose ps $service --format json 2>/dev/null | grep -o '"State":"[^"]*"' | cut -d'"' -f4)
        if [ "$status" = "running" ]; then
            print_warning "$service: running (no health check)"
        else
            print_error "$service: $status"
        fi
    else
        print_error "$service: $health"
    fi
done

# Проверка портов
print_header "Проверка портов"
ports=("80:nginx" "443:nginx" "5432:postgres" "6379:redis" "5672:rabbitmq" "15672:rabbitmq-management")
for port_info in "${ports[@]}"; do
    port="${port_info%%:*}"
    service="${port_info#*:}"
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        print_ok "Порт $port ($service) - занят"
    else
        print_warning "Порт $port ($service) - свободен"
    fi
done

# Проверка логов на ошибки
print_header "Последние ошибки в логах"
echo "Backend errors:"
docker compose logs backend --tail 100 2>/dev/null | grep -i "error" | tail -5 || echo "  Нет ошибок"
echo ""
echo "Frontend errors:"
docker compose logs frontend --tail 100 2>/dev/null | grep -i "error" | tail -5 || echo "  Нет ошибок"

# Проверка API endpoints
print_header "Проверка API endpoints"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health | grep -q "200"; then
    print_ok "Backend API health check: OK"
else
    print_error "Backend API health check: FAILED"
fi

# Проверка использования ресурсов
print_header "Использование ресурсов"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Проверка дискового пространства
print_header "Дисковое пространство"
df -h | grep -E "/$|/var/lib/docker" || df -h /

# Итоговая информация
print_header "Полезные команды"
echo "📋 Просмотр логов:"
echo "   docker compose logs -f [service]"
echo ""
echo "🔧 Перезапуск сервиса:"
echo "   docker compose restart [service]"
echo ""
echo "🚀 Полная пересборка:"
echo "   docker compose up -d --build"
echo ""
echo "🗑️  Очистка системы:"
echo "   docker system prune -a"