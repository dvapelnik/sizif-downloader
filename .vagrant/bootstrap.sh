#!/bin/sh

sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

sudo apt-get update

sudo apt-get install -y curl openssl git mongodb rabbitmq-server nodejs npm

sudo ln -s `which nodejs` /usr/bin/node

sudo npm install -g bower

sudo npm install -g grunt-cli
sudo chmod 777 ~/tmp/

cd /tmp/ewc
npm install
bower install --config.interactive=false
grunt

node node_modules/.bin/supervisor server/downloader.js &
node node_modules/.bin/supervisor server/app.js