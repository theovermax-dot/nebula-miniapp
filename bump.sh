#!/bin/sh
# Сбрасывает кэш Telegram: новая метка версии во всех ссылках на JS и CSS
V=$(date +%s)
sed -i -E "s#(/assets/(app\.css|js/app\.js))(\?v=[0-9]+)?\"#\1?v=$V\"#g" index.html
sed -i -E "s#from '\./([a-z]+)\.js(\?v=[0-9]+)?'#from './\1.js?v=$V'#g" assets/js/*.js
echo "v=$V"
