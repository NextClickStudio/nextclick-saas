#!/bin/sh
# Builds public/yeppo-extension.zip with everything inside one folder, yeppo-extension/, so unzipping it on any
# system gives a single folder to pick in chrome://extensions (Load unpacked).
set -e
cd "$(dirname "$0")"
tmp=$(mktemp -d)
cp -R extension "$tmp/yeppo-extension"
find "$tmp/yeppo-extension" -name '.*' -exec rm -rf {} +
rm -f public/yeppo-extension.zip
(cd "$tmp" && zip -qr - yeppo-extension) > public/yeppo-extension.zip
rm -rf "$tmp"
unzip -l public/yeppo-extension.zip
