/**
 * Created by jacobsu on 15/4/29.
 * for multicore capability
 */
var cluster = require('cluster');
var numCPUs = require('os').cpus().length;

if (cluster.isMaster) {

  //fork a worker to run the main program
  for (var i = 0; i < numCPUs; i++) {
    var worker = cluster.fork();
  }

  cluster.on('exit', function(worker, code, signal) {
    console.log('worker ' + worker.process.pid + ' died');
  });
} else {

    //change this line to Your Node.js app entry point.
    require("./index.js");
    console.log('worker is running');
}
