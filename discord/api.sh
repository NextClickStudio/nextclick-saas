#!/bin/zsh
# discord API call with the bot token from the protected file: api.sh METHOD PATH [JSON]
T=$(cat "$(dirname $0)/.token")
if [ -n "$3" ]; then curl -s -X "$1" "https://discord.com/api/v10$2" -H "Authorization: Bot $T" -H "Content-Type: application/json" -H "User-Agent: DiscordBot (yeppo, 1.0)" -d "$3"
else curl -s -X "$1" "https://discord.com/api/v10$2" -H "Authorization: Bot $T" -H "User-Agent: DiscordBot (yeppo, 1.0)"; fi
