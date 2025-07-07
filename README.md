# Фронтенд для Общего Дела

## Переменные окружения

| Поле        | Описание                             |
| ----------- | ------------------------------------ |
| WP_USER     | username из админки wordpress        |
| WP_PASSWORD | Сгенерированный application password |

## Локальная разработка

Приложение в дев режиме можно запустить внутри докер контейнера или локально.

### Общие шаги

1. Создать пароль по [инструкции](https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/) в админке wordpress.
2. Создать файл `.env`
3. Добавить `.env` переменные `WP_USER` и `WP_PASSWORD`

### На локальной машине

1. Установить `nvm`
2. Запустить `nvm use`
3. Установить нужную версию `pnpm` глобально - `npm install -g pnpm@10.12.1`
4. Установить зависимости - `pnpm i --frozen-lockfile`
5. Запустить проект в дев режиме - `pnpm dev`

### Внутри Docker container

Для запуска nextjs приложения внутри контейнера для локальной разработки:
`docker-compose up --build frontend-local`

#### Команды

`pnpm dev` - запуск в dev режиме
`pnpm lint` - запуск линтера
`pnpm format` - запуск форматера
`pnpm build` - сборка для прода
`pnpm start` - запуск приложения (прод)
