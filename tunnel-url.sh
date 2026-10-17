#!/bin/sh
# Prints the current public tunnel address.
grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /Users/hometree/vivero-rosas/tunnel.log 2>/dev/null | tail -1
