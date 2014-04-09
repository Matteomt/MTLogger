MTLogger
========

A node.js module for logging using JSON and text file storage.

Basic usage example:
```js
myLogger = require('MTLogger').setup("./my_log_file.log");
myLogger.info("Hello, world!");
```

MTLogger is one of the infinite ways to:
* log text messages, using 6 log levels and relative logging functions: `silly`, `debug`, `verbose`, `info`, `warn`, `error`;
* read the log with 4 query functions: `newest`, `oldest`, `newerThen`, `all`;
* keep the log in sync with a text file.



.



Progressive 10-points tutorial:
-------------------------------
```js
//0. Import the module
MTLogger = require ('./MTLogger.js');

//1. Initialize your logger object (there are different ways)
var myLogger = MTLogger.setup({
  file: "./my_log_file.log",
  load_limit: 200000
});
//it will load the last 200000 bytes of the specified text file.

//2. Log something, like a very annoying message
myLogger.silly("Hi there, I am very glad to publish "
             + "my first repository on GitHub :) ");

//3. Or log an important error message
myLogger.error("Help, no more chocolate!");

//4. Eventualy make a query to get the last log entry
myLogger.newest();
//that will return the following object
//without reading the log file:
//{ timestamp: 1396826581187,
//  level: 'error',
//  message: 'Help, no more chocolate!',
//  id: 1 }

//5. Get an array of all the log entries from 2 hours ago
myLogger.newerThen({timestamp: Date.now() - 1000*60*60*2});


//6. Initialize a second concurrent logger
var myExceptionLogger = new MTLogger("./my_nodejs_brutal_exits.log", 1);
//Why not? But with a history limit of 1 log entry

//7. And use it to log uncaught exceptions
process.on('uncaughtException', function(e) {
myExceptionLogger.error(e.toString());
process.exit();
});
//Now, if you make any mistake outside try/catchs,
// the error messages will be logged to file (instead of
// written to the console) before letting node.js crash.


setTimeout(function(){

    //8. Why did my script crashed?
    var lastCrashLog = myExceptionLogger.newest();
    //Obviously, the initialization of the logger (point 5)
    // implies an asyncronous read of the log file.
    // So, the messages logged during the previous
    // sessions are loaded in memory and you can
    // query them like above. In this case you will
    // not get more than ONE message because of
    // the history limit. Also note that if you
    // are too fast, you will get nothing because
    // you have to let it finish the initialization
    // by waiting some milliseconds and that's a 
    // KNOWN BUG! (event emitters will help)

    //9. Report crash message with date and time, only once
    if(lastCrashLog.level == 'error'){
        console.log("Crash reported: " + new Date(lastCrashLog.timestamp));
        console.log(" reason: " + lastCrashLog.message);
        myExceptionLogger.info("Crash reported");
    }

}, 50);
```


Brief reference
---------------


###`setup(options)`
This is not a method of MTLogger, but a function that returns a new MTLogger object by calling the following constructor.
`options` must be an object with the parameters for the MTLogger constructor as proprieties.

###MTLogger constructor
`MTLogger(log_file_path, [log_history_limit], [log_load_byte_limit])`

It returns an MTLogger object.

The first optional numeric parameter **limits the number of log entries kept in memory**. It will not limit the log file size.

The secondo optional numeric parameter lets you load the newest log entries by **reading only the tail of the log file**.


###Logging functions

`silly(message)`
`debug(message)`
`verbose(message)`
`info(message)`
`warn(message)`
`error(message)`

They push a message in the log (on the memory and at the end of the log file).

The only parameter must be the string that you want to log.

Example: `yourLogger.debug('test');`


###Query functions

#####`count()`
Returns the count of all the log entries.

#####`all()`
Returns an array containing all the log entries.

#####`newest([older])`
Returns the last log entry. Specifying a numeric parameter, you can go back getting the n-th to last entry kept in memory.
Example:
```js
myLogger.debug('0'); myLogger.debug('1'); myLogger.debug('2'); myLogger.debug('3');
myLogger.newest(0).message //returns '3'
myLogger.newest(1).message //returns '2
```

#####`oldest([newer])`
Returns the oldest log entry kept in memory (see the first parameter of the costructor). Specifying a numeric parameter, you can go forward getting the n-th entry.
Example:
```js
myLogger.debug('a'); myLogger.debug('b'); myLogger.debug('c'); myLogger.debug('d');
myLogger.oldest(0).message //returns 'a'
myLogger.oldest(1).message //returns 'b'
```

#####`newerThen(older)`
Returns an array containing all the log entries after that specified as parameter (excluded). The parameter may be a log entry or an object with the proprieties `timestamp` and `id:-1`.

#####`filtered(filter_callback)`
Returns an array containing all the log entries that pass your custom filter. `filter_callback` must be a function that takes a log entry as parameter and returns true if you want to get that entry; false otherwise.


###Other functions

#####`limit(new_hist_limit)`
Get/set log entry count limit. This function ignores the actual limit of the system resources.

#####`file()`
Get the file path used by the logger. If file storege was not been enabled, it will return null.

#####`file(file_path, [load_limit], [callback])`
Enables file storage if `file_path` is a string; disables otherwise. When enabling file storage, it will try to load the log from the specified file, asyncronously, temporally putting the next logs in a queue. If the file storage was already enabled, it will also delete all the entries previously stored in memory. `load_limit` allows you to load from large files by specifying the maximum number of bytes to read starting from the end. The default value is 5000 bytes. You have to specify this argument in order to specify the next. `callback` must be a function that accepts 2 arguments: the first will be an exception or null if everything is OK; the second argument will be the count of log entries loaded from the file. The returned value of your callback will be ignored.


TO-DO-list:
-----------
* ~~get log count~~
* ~~get/set history limit~~
* ~~allow the use of an object as parameter of the constructor.~~
* allow the definition of a custom array of log levels
* ~~generic query function filtering log by level too~~
* ~~make logging functions async, that wait for writeability, so I can do the following:~~
* ~~make the file loading function block the logging functions~~
* queue the log entries before appending to file, and do it in an event, maybe, so I can do the following:
* add/remove log files, with filters.
* watch file(s) for logs from other processes and allow this function to be disabled.
* Maybe I'm making this tooooo much complex to call it as a "simple logger"?
