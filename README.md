# Sizif Downloader


**Sizif Downloader** is jobs and queue based dounloader service with simple API

## Run with [Vagrant](https://www.vagrantup.com/)


1. `vagrant up`
2. Wait some time for setup dependencies? build application and starting services (starting may take up to 5 minutes; it's depends on hardware configuration)
3. Go on [`http://localhost:8888`](http://localhost:8888)
4. API documentation located at [`http://localhost:8888/doc`](http://localhost:8888/doc)

You should see messages about connect to `RabbitMQ` (`amqp`) and `MongoDB` **twice** like this:

```
................................
Running node-supervisor with

  program 'server/app.js'
  --watch '.'
  --extensions 'node,js'
  --exec 'node'

Starting child process with 'node server/app.js'
Running node-supervisor with
  program 'server/downloader.js'
  --watch '.'
  --extensions 'node,js'
  --exec 'node'

Starting child process with 'node server/downloader.js'
Watching directory '/tmp/ewc' for changes.
Press rs for restarting the process.
Watching directory '/tmp/ewc' for changes.
Press rs for restarting the process.

info: [libs/amqp.js] Connected to amqp://localhost
info: [libs/mongoose.js] Connected to DB!
Server started on http://0.0.0.0:8888
info: [libs/amqp.js] Connected to amqp://localhost
info: [libs/mongoose.js] Connected to DB!
................................
```

## Run standalone

### Requirements

1. `RabbitMQ`
2. `MongoDB`
3. `NodeJS` with `npm`
3. `bower`
4. `grunt`# Sizif Downloader

**Sizif Downloader** is jobs and queue based dounloader service with simple API

## Run with [Vagrant](https://www.vagrantup.com/)

1. `vagrant up`
2. Wait some time for setup dependencies? build application and starting services (starting may take up to 5 minutes; it's depends on hardware configuration)
3. Go on [`http://localhost:8888`](http://localhost:8888)
4. API documentation located at [`http://localhost:8888/doc`](http://localhost:8888/doc)

You should see messages about connect to `RabbitMQ` (`amqp`) and `MongoDB` **twice** like this:

```
Running node-supervisor with

  program 'server/app.js'
  --watch '.'
  --extensions 'node,js'
  --exec 'node'

Starting child process with 'node server/app.js'
Running node-supervisor with
  program 'server/downloader.js'
  --watch '.'
  --extensions 'node,js'
  --exec 'node'

Starting child process with 'node server/downloader.js'
Watching directory '/tmp/ewc' for changes.
Press rs for restarting the process.
Watching directory '/tmp/ewc' for changes.
Press rs for restarting the process.

info: [libs/amqp.js] Connected to amqp://localhost
info: [libs/mongoose.js] Connected to DB!
Server started on http://0.0.0.0:8888
info: [libs/amqp.js] Connected to amqp://localhost
info: [libs/mongoose.js] Connected to DB!
```
## Run standalone

### Requirements

1. `RabbitMQ`
2. `MongoDB`
3. `NodeJS` with `npm`
3. `bower`
4. `grunt`

### Run

```bash
$ cd /path/to/project
$ npm install
$ bower install
$ grunt
$ node server/dosnloader.js &
$ node server/app.js
```
##About

1. Webserver: [Express4](http://expressjs.com/)
2. Queue manager: [RabbitMQ](http://www.rabbitmq.com/) wrapped with [ampqlib](https://github.com/squaremo/amqp.node)
3. HTML processing and saving images takes place in separate process. It starts with `server/downloader.js` file
4. All data persisted in [MongoDB](https://www.mongodb.org/) wrapped with [mongoose](http://mongoosejs.com/)
5. Only one job may execute at same time. It can be modified at `server/config.json` at `amqp.queue.mainJob.limit` position.

### Run

```bash
$ cd /path/to/project
$ npm install
$ bower install
$ grunt
$ node server/dosnloader.js &
$ node server/app.js
```

##About 

1. Webserver: [Express4](http://expressjs.com/)
2. Queue manager: [RabbitMQ](http://www.rabbitmq.com/) wrapped with [ampqlib](https://github.com/squaremo/amqp.node)
3. HTML processing and saving images takes place in separate process. It starts with `server/downloader.js` file
4. All data persisted in [MongoDB](https://www.mongodb.org/) wrapped with [mongoose](http://mongoosejs.com/)
5. Only one job may execute at same time. It can be modified at `server/config.json` at `amqp.queue.mainJob.limit` position.