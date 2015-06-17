# RabbitMQRPCWorker
Use amqplib to set up a nodejs application to be a RabbitMQ RPC worker capable of working on multi-cpu-core. This is a example to show your guys how to use amqplib to do the RabbitMQ RPC worker job.

## setup##
```shell
  npm install -g forever
  npm install
```

## run on sinle cpu core##
```shell
  node index.js
```
  or
```shell
  forever start index.js
```

## run on multi cpu core
```shell
  node cluster.js
```
  or
```shell
  forever start cluster.js
```

## get message and do the message job from queue##
```javascript
amqpRecv.connect(rmqURI).then(function(connRecv) {
    process.once('SIGINT', function() { connRecv.close(); });
    return connRecv.createChannel().then(function(chRecv) {
        var ok = when.all([
            chRecv.assertQueue(recvQ, {durable: false}),
            chRecv.assertExchange(rmqExch),
            chRecv.bindQueue(recvQ,rmqExch,recvRouterKey)
        ]);
        
        ok = ok.then(function() { chRecv.prefetch(1); });
        ok = ok.then(function() {
            chRecv.consume(recvQ, doWork, {noAck: false});    //doWork is a method to do the remote procedure work
          console.log(" [*] Waiting for messages. To exit press CTRL+C");
        });
        
        return ok;
        
        function doWork(msgRecv){
        
          console.log(msgRecv);                              //print recieved message content
          console.log(msgRecv.properties.correlationId);     //print recieved message correlationId (for the RPC caller to find with)
          
          //TODO
          //......put your code here
          
          
          //call this method here for a simple introduction, usually we do it when we send out the result, please follow the way I call this methond in the "send the procudure result to RabbitMQ" paragraph 
          chRecv.ack(msgRecv);                               //tell rabbitmq the message is cosumed, usually call this method when the message job is done
        }
    });
}).then(null, console.warn);
```

## send the procudure result to RabbitMQ##
```javascript
        //callBackMsg normally is a JSON Object
        function sendCallBack(callBackMsg,msgRecv) {
            amqpSend.connect(rmqURI).then(function (connSend) {
                return when(connSend.createChannel().then(function (chSend) {
                    var ok = when.all([
                        chSend.assertQueue(sendQ, {durable: false}),
                        chSend.assertExchange(rmqExch),
                        chSend.bindQueue(sendQ, rmqExch, sendRouterKey)
                    ]);
                    return ok.then(function () {
                        console.log(" [x] connected to sendQ")
                        var msgSend = JSON.stringify(callBackMsg);
                        console.log(" [x] msgSend is '%s'", msgSend)
                        var corrId = msgRecv.properties.correlationId; //use the corrId for the RPC caller to find with
                        console.log(" [x] corrId is '%s'", corrId)
                        chSend.sendToQueue(sendQ, new Buffer(msgSend), {correlationId: corrId}); //add the corrId in the result message to send
                        console.log(" [x] Sent to new Q");
                        return chSend.close();
                    });
                })).ensure(function () {
                    connSend.close();
                    console.log(" [x] Done");
                    chRecv.ack(msgRecv);                               //tell rabbitmq the message is cosumed, usually call this method when the message job is done
                });
            }).then(null, console.warn);
        }
```
