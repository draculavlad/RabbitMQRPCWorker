#!/usr/bin/env node
var amqpRecv = require('amqplib');
var amqpSend = require('amqplib');
var when = require('when');
var request = require('request');
var helpers = require('./helpers');
var encodinglib = require("encoding");
var config = require("./config");

var usr = config.rmqUser;
var passwd =  config.rmqPass;
var host = config.rmqHost;
var port = config.rmqPort;
//if vHost is "/", then config should be "%2F"; if vHost is "/foo", then config should be "%2Ffoo";
var vHost = config.rmqVirtualHost;
var URI = "amqp://"+usr+":"+passwd+"@"+host+":"+port+"/"+vHost;
var rmqURI = URI;
var rmqExch = config.rmqExch;
var recvQ = config.recvQ;
var recvRouterKey = config.recvRouterKey;
var sendQ = config.sendQ;
var sendRouterKey = config.sendRouterKey;

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
            chRecv.consume(recvQ, doWork, {noAck: false});
          console.log(" [*] Waiting for messages. To exit press CTRL+C");
        });

        return ok;

        function doWork(msgRecv) {
          console.log(" [x] Received corrId '%s'",msgRecv.properties.correlationId);
          console.log(" [x] Received msg '%s'", msgRecv.content.toString());
          sendCallBack("jobDone", msgRecv);
        }

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

                        var corrId = msgRecv.properties.correlationId;
                        console.log(" [x] corrId is '%s'", corrId)
                        chSend.sendToQueue(sendQ, new Buffer(msgSend), {correlationId: corrId});
                        console.log(" [x] Sent to new Q");
                        return chSend.close();
                    });
                })).ensure(function () {
                    connSend.close();
                    console.log(" [x] Done");
                    chRecv.ack(msgRecv);
                });
            }).then(null, console.warn);
        }
    });
}).then(null, console.warn);
